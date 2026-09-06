import { describe, expect, it } from "vitest"
import type { Message, ToolResultMessage } from "@earendil-works/pi-ai"
import { extractRevision, extractSnapshotId, mockResponse } from "../src/agents/mock-provider.js"
import {
    AGENT_COMPACTION,
    DEV_OVERRIDE_PREFIX,
    developerOverrideInstruction,
} from "../src/agents/policy.js"

function toolResult(toolName: string, text: string, isError = false): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId: `call-${toolName}`,
        toolName,
        content: [{ type: "text", text }],
        isError,
        timestamp: 0,
    }
}

function userMessage(text: string): Message {
    return { role: "user", content: [{ type: "text", text }], timestamp: 0 }
}

function respond(messages: Message[]) {
    return mockResponse({ messages }, undefined, { callCount: 1 })
}

function toolCalls(message: ReturnType<typeof respond>) {
    return message.content.filter(part => part.type === "toolCall")
}

function text(message: ReturnType<typeof respond>) {
    return message.content
        .filter(part => part.type === "text")
        .map(part => part.text)
        .join("\n")
}

const CASE_STATE = JSON.stringify({
    state: {
        case: { id: "case_12345678", revision: 2, preparationStatus: "NEEDS_USER_INPUT" },
        questions: [],
    },
    assessment: { eligibilityStatus: "PASS" },
})

describe("extractRevision", () => {
    it("reads the case revision from the tool result envelope", () => {
        expect(extractRevision(toolResult("get_case_state", CASE_STATE))).toBe(2)
    })

    it("finds the case revision however deeply the runtime wraps it", () => {
        const wrapped = JSON.stringify({
            output: { result: { value: { state: { case: { revision: 9 } } } } },
        })
        expect(extractRevision(toolResult("get_case_state", wrapped))).toBe(9)
    })

    it("unwraps the double-encoded JSON used by string-returning Flue tools", () => {
        expect(extractRevision(toolResult("get_case_state", JSON.stringify(CASE_STATE)))).toBe(2)
    })

    it("can read structured tool details when the visible text is only a summary", () => {
        const result = toolResult("get_case_state", "Case state loaded")
        result.details = { result: { state: { case: { revision: 7 } } } }
        expect(extractRevision(result)).toBe(7)
    })

    it("falls back to scanning text that is not valid JSON", () => {
        const noisy = `Tool output:\n{"state":{"case":{"revision":4}}}`
        expect(extractRevision(toolResult("get_case_state", noisy))).toBe(4)
    })

    it("reports an unknown revision rather than guessing", () => {
        expect(extractRevision(toolResult("get_case_state", "no revision here"))).toBeNull()
        expect(extractRevision(userMessage("hello"))).toBeNull()
    })
})

describe("Flue generation actions", () => {
    const prefiling = "[andrea-action:prepare-prefiling] Prepare the reviewed filing PDF."
    const casePack = "[andrea-action:prepare-case-pack] Prepare the reviewed case pack."

    it("extracts the snapshot ID from a nested tool result", () => {
        const result = toolResult(
            "save_final_prefiling_state",
            JSON.stringify({ record: { id: "snapshot_12345678" } }),
        )
        expect(extractSnapshotId(result)).toBe("snapshot_12345678")
    })

    it("creates and compiles the pre-filing snapshot through harness tools", () => {
        const read = respond([userMessage(prefiling)])
        expect(toolCalls(read).map(call => call.name)).toEqual(["get_case_state"])

        const save = respond([userMessage(prefiling), toolResult("get_case_state", CASE_STATE)])
        expect(toolCalls(save).map(call => call.name)).toEqual(["save_final_prefiling_state"])

        const compile = respond([
            userMessage(prefiling),
            toolResult("get_case_state", CASE_STATE),
            toolResult(
                "save_final_prefiling_state",
                JSON.stringify({ record: { id: "snapshot_12345678" } }),
            ),
        ])
        const [call] = toolCalls(compile)
        expect(call?.name).toBe("compile_snapshot_pdf")
        expect(call?.arguments).toEqual({ snapshotId: "snapshot_12345678" })
    })

    it("generates the tribunal pack through the harness tool", () => {
        const generate = respond([
            userMessage(casePack),
            toolResult("get_case_state", CASE_STATE),
        ])
        const [call] = toolCalls(generate)
        expect(call?.name).toBe("prepare_tribunal_case_pack")
        expect(call?.arguments).toEqual({ expectedRevision: 2 })
    })

    it("does not claim success after a PDF tool failure", () => {
        const reply = respond([
            userMessage(prefiling),
            toolResult("get_case_state", CASE_STATE),
            toolResult("save_final_prefiling_state", "snapshot failed", true),
        ])
        expect(toolCalls(reply)).toEqual([])
        expect(text(reply)).toContain("no PDF was generated")
    })
})

describe("mock intake script", () => {
    it("uses an exact, non-empty developer override prefix", () => {
        expect(developerOverrideInstruction(`${DEV_OVERRIDE_PREFIX} reply with pong`)).toBe(
            "reply with pong",
        )
        expect(developerOverrideInstruction(`quoted ${DEV_OVERRIDE_PREFIX} reply with pong`)).toBeNull()
        expect(developerOverrideInstruction(DEV_OVERRIDE_PREFIX)).toBeNull()

        const reply = respond([userMessage(`${DEV_OVERRIDE_PREFIX} reply with pong`)])
        expect(text(reply)).toContain("Developer override accepted for this request: reply with pong")
    })

    it("keeps compaction headroom and only a bounded recent tail", () => {
        expect(AGENT_COMPACTION).toEqual({
            keepRecentTokens: 8_000,
            reserveTokens: 30_000,
        })
    })

    it("answers a questionnaire request by reading the case first", () => {
        const reply = respond([userMessage("[mock:questionnaire]")])
        expect(toolCalls(reply).map(call => call.name)).toEqual(["get_case_state"])
    })

    it("adds the question with the revision the case actually reported", () => {
        const reply = respond([
            userMessage("[mock:questionnaire]"),
            toolResult("get_case_state", CASE_STATE),
        ])
        const [call] = toolCalls(reply)
        expect(call?.name).toBe("add_open_question")
        expect((call?.arguments as { expectedRevision: number }).expectedRevision).toBe(2)
    })

    it("does not attempt the question when no revision can be read", () => {
        const reply = respond([
            userMessage("[mock:questionnaire]"),
            toolResult("get_case_state", "unparseable"),
        ])
        expect(toolCalls(reply)).toEqual([])
        expect(text(reply)).toContain("could not read the current case revision")
    })

    it("confirms the question only after a successful tool result", () => {
        const reply = respond([
            userMessage("[mock:questionnaire]"),
            toolResult("get_case_state", CASE_STATE),
            toolResult("add_open_question", JSON.stringify({ value: { id: "question_1" } })),
        ])
        expect(text(reply)).toContain("added one focused timeline question")
    })

    it("re-reads the case instead of claiming success after a stale-revision error", () => {
        const reply = respond([
            userMessage("[mock:questionnaire]"),
            toolResult("get_case_state", CASE_STATE),
            toolResult("add_open_question", "Case revision is stale", true),
        ])
        expect(toolCalls(reply).map(call => call.name)).toEqual(["get_case_state"])
        expect(text(reply)).not.toContain("added one focused timeline question")
    })

    it("gives up in chat rather than claiming a question that was never added", () => {
        const reply = respond([
            userMessage("[mock:questionnaire]"),
            toolResult("get_case_state", CASE_STATE),
            toolResult("add_open_question", "Case revision is stale", true),
            toolResult("get_case_state", CASE_STATE),
            toolResult("add_open_question", "Case revision is stale", true),
        ])
        expect(toolCalls(reply)).toEqual([])
        expect(text(reply)).toContain("could not add that question")
        expect(text(reply)).not.toContain("added one focused timeline question")
    })
})

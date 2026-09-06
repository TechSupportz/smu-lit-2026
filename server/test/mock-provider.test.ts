import { describe, expect, it } from "vitest"
import type { Message, ToolResultMessage } from "@earendil-works/pi-ai"
import { extractRevision, mockResponse } from "../src/agents/mock-provider.js"

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

describe("mock intake script", () => {
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

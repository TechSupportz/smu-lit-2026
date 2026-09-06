import {
    fauxAssistantMessage,
    fauxProvider,
    fauxThinking,
    fauxToolCall,
    type AssistantMessage,
    type Context,
    type Message,
} from "@earendil-works/pi-ai"
import { developerOverrideInstruction } from "./policy.js"

const MOCK_PROVIDER_ID = "claimguide-mock"
const MOCK_MODEL_ID = "scripted-intake"
const MOCK_RESPONSE_CAPACITY = 10_000

export const mockModelSpecifier = `${MOCK_PROVIDER_ID}/${MOCK_MODEL_ID}`

function messageText(message: Message): string {
    if (message.role === "user") {
        return typeof message.content === "string"
            ? message.content
            : message.content
                  .filter(part => part.type === "text")
                  .map(part => part.text)
                  .join("\n")
    }
    if (message.role === "toolResult") {
        return message.content
            .filter(part => part.type === "text")
            .map(part => part.text)
            .join("\n")
    }
    return message.content
        .filter(part => part.type === "text")
        .map(part => part.text)
        .join("\n")
}

function latestUserText(context: Context): string {
    const message = [...context.messages].reverse().find(item => item.role === "user")
    return message ? messageText(message) : ""
}

/**
 * Finds the case revision inside an arbitrarily shaped value. The tool output is
 * a JSON string whose exact envelope is decided by the runtime, so the first
 * `case.revision` found anywhere in the tree wins, with any other `revision`
 * number as a second choice. Guessing `1` here is what produced a stale
 * `expectedRevision` in the browser trace.
 */
function findRevision(value: unknown, depth = 0): number | null {
    if (depth > 8 || value === null) return null
    if (typeof value === "string") {
        try {
            return findRevision(JSON.parse(value) as unknown, depth + 1)
        } catch {
            const match = /\\?"revision\\?"\s*:\s*(\d+)/.exec(value)
            return match ? Number(match[1]) : null
        }
    }
    if (typeof value !== "object") return null
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findRevision(item, depth + 1)
            if (found !== null) return found
        }
        return null
    }
    const record = value as Record<string, unknown>
    const caseValue = record.case
    if (caseValue !== null && typeof caseValue === "object" && !Array.isArray(caseValue)) {
        const revision = (caseValue as Record<string, unknown>).revision
        if (typeof revision === "number") return revision
    }
    for (const entry of Object.values(record)) {
        const found = findRevision(entry, depth + 1)
        if (found !== null) return found
    }
    if (typeof record.revision === "number") return record.revision
    return null
}

function findStringField(value: unknown, field: string, depth = 0): string | null {
    if (depth > 8 || value === null) return null
    if (typeof value === "string") {
        try {
            return findStringField(JSON.parse(value) as unknown, field, depth + 1)
        } catch {
            return null
        }
    }
    if (typeof value !== "object") return null
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findStringField(item, field, depth + 1)
            if (found !== null) return found
        }
        return null
    }
    const record = value as Record<string, unknown>
    if (typeof record[field] === "string") return record[field]
    for (const entry of Object.values(record)) {
        const found = findStringField(entry, field, depth + 1)
        if (found !== null) return found
    }
    return null
}

export function extractRevision(message: Message): number | null {
    if (message.role !== "toolResult") return null
    // Inspect the whole message as well as its text. Flue may put structured tool
    // data in `details`, and string-returning tools can arrive JSON-encoded twice.
    return findRevision(message)
}

export function extractSnapshotId(message: Message): string | null {
    if (message.role !== "toolResult") return null
    return findStringField(message, "id")
}

function withThinking(text: string): AssistantMessage {
    return fauxAssistantMessage([
        fauxThinking("Reviewing the saved case and choosing the clearest next step."),
        { type: "text", text },
    ])
}

function mockResponse(
    context: Context,
    _options: unknown,
    state: { callCount: number },
): AssistantMessage {
    const latest = context.messages.at(-1)
    const userText = latestUserText(context)
    const toolId = `mock-tool-${state.callCount}`

    const override = developerOverrideInstruction(userText)
    if (override) {
        return withThinking(`Developer override accepted for this request: ${override}`)
    }

    const preparePrefiling = userText.startsWith("[andrea-action:prepare-prefiling]")
    const prepareCasePack = userText.startsWith("[andrea-action:prepare-case-pack]")

    if ((preparePrefiling || prepareCasePack) && latest?.role === "user") {
        return fauxAssistantMessage(fauxToolCall("get_case_state", {}, { id: toolId }), {
            stopReason: "toolUse",
        })
    }

    if (
        (preparePrefiling || prepareCasePack) &&
        latest?.role === "toolResult" &&
        latest.toolName === "get_case_state"
    ) {
        const revision = extractRevision(latest)
        if (revision === null) {
            return withThinking(
                "I could not verify the current case revision, so no PDF was generated.",
            )
        }
        return fauxAssistantMessage(
            fauxToolCall(
                preparePrefiling ? "save_final_prefiling_state" : "prepare_tribunal_case_pack",
                { expectedRevision: revision },
                { id: toolId },
            ),
            { stopReason: "toolUse" },
        )
    }

    if (
        preparePrefiling &&
        latest?.role === "toolResult" &&
        latest.toolName === "save_final_prefiling_state"
    ) {
        if (latest.isError) {
            return withThinking("The reviewed snapshot could not be created, so no PDF was generated.")
        }
        const snapshotId = extractSnapshotId(latest)
        if (!snapshotId) {
            return withThinking("The snapshot result had no ID, so no PDF was generated.")
        }
        return fauxAssistantMessage(
            fauxToolCall("compile_snapshot_pdf", { snapshotId }, { id: toolId }),
            { stopReason: "toolUse" },
        )
    }

    if (
        preparePrefiling &&
        latest?.role === "toolResult" &&
        latest.toolName === "compile_snapshot_pdf"
    ) {
        return latest.isError
            ? withThinking("The snapshot was saved, but PDF compilation failed.")
            : withThinking("Your pre-filing summary PDF was generated from the reviewed case.")
    }

    if (
        prepareCasePack &&
        latest?.role === "toolResult" &&
        latest.toolName === "prepare_tribunal_case_pack"
    ) {
        return latest.isError
            ? withThinking("The tribunal case pack could not be generated.")
            : withThinking("Your cue card and tribunal case pack were generated from the reviewed case.")
    }

    if (latest?.role === "toolResult" && latest.toolName === "get_case_state") {
        const revision = extractRevision(latest)
        if (revision === null) {
            return withThinking(
                "I could not read the current case revision, so I will not try to add a question. Tell me in your own words when you first asked the business to put things right.",
            )
        }
        return fauxAssistantMessage(
            fauxToolCall(
                "add_open_question",
                {
                    expectedRevision: revision,
                    question: "When did you first ask the business to put things right?",
                    reason:
                        "This helps build a clear timeline and records whether the business had a chance to respond.",
                    relatedFactIds: [],
                    priority: "IMPORTANT",
                    suggestedAnswer:
                        "I contacted the business on 18 August 2026 and asked for a refund.",
                },
                { id: toolId },
            ),
            { stopReason: "toolUse" },
        )
    }

    if (latest?.role === "toolResult" && latest.toolName === "add_open_question") {
        if (!latest.isError) {
            return withThinking(
                "I’ve added one focused timeline question below. You can use the suggested answer as-is or edit it first.",
            )
        }
        // The tool rejected the call. Never report a questionnaire that does not
        // exist: re-read the case once for a fresh revision, then fall back to chat.
        const failures = context.messages.filter(
            message =>
                message.role === "toolResult" &&
                message.toolName === "add_open_question" &&
                message.isError,
        ).length
        if (failures < 2) {
            return fauxAssistantMessage(fauxToolCall("get_case_state", {}, { id: toolId }), {
                stopReason: "toolUse",
            })
        }
        return withThinking(
            "I could not add that question to your case, so I will ask it here instead: when did you first ask the business to put things right?",
        )
    }

    if (userText.includes("[mock:error]")) {
        return fauxAssistantMessage([], {
            stopReason: "error",
            errorMessage: "Mock provider failure for error-state UI testing.",
        })
    }

    if (userText.includes("[mock:questionnaire]")) {
        return fauxAssistantMessage(
            fauxToolCall("get_case_state", {}, { id: toolId }),
            { stopReason: "toolUse" },
        )
    }

    if (userText.includes("[mock:long]")) {
        return withThinking(`Here’s a longer response for checking line length, scrolling and Markdown rhythm.

### What I understand so far

- You paid a deposit for a service.
- The service was not completed on the agreed date.
- You contacted the business and asked for the money back.

### What would help next

Please share the date of payment, the promised completion date, and any written reply from the business. If you have a receipt or message thread, you can attach it here. Keep the originals; this workspace only helps you prepare your information before filing.`)
    }

    if (userText.includes("[mock:warning]")) {
        return withThinking(
            "I can continue, but one detail is still uncertain: the event date may affect the filing time limit. Add the exact date if you know it; otherwise say that it is an estimate.",
        )
    }

    if (
        userText.startsWith("Read the current case and conversation.") ||
        userText.startsWith("Start the pre-filing conversation.")
    ) {
        return withThinking(
            "Tell me what happened in your own words, starting with what you agreed to buy or receive and what went wrong.",
        )
    }

    if (userText.startsWith("I have submitted my questionnaire answers.")) {
        return withThinking(
            "Thanks — I’ve recorded that answer in the case timeline. What outcome did you ask the business for?",
        )
    }

    const replies = [
        "Thanks. What did the business promise to provide, and when was it due?",
        "What amount did you pay, and do you have a receipt or payment confirmation?",
        "What did you ask the business to do after the problem happened?",
        "Did the business reply? If so, share their wording as closely as you can.",
    ]
    const visibleUserTurns = context.messages.filter(message => message.role === "user").length
    return withThinking(replies[Math.max(0, visibleUserTurns - 1) % replies.length]!)
}

export { mockResponse }

export function createMockAgentProvider() {
    const handle = fauxProvider({
        provider: MOCK_PROVIDER_ID,
        api: "claimguide-scripted",
        models: [
            {
                id: MOCK_MODEL_ID,
                name: "Andrea scripted intake",
                reasoning: true,
                input: ["text", "image"],
            },
        ],
        tokensPerSecond: 24,
        tokenSize: { min: 2, max: 4 },
    })
    handle.setResponses(Array.from({ length: MOCK_RESPONSE_CAPACITY }, () => mockResponse))
    return handle.provider
}

import { describe, expect, it } from "vitest"
import {
    buildTranscript,
    clearSubmittedAttachments,
    dedupeEntries,
    isThinking,
    selectPendingAttachments,
    type TranscriptEntry,
} from "./chat-view"

const message = (id: string) => ({ id })

const entry = (
    questionId: string,
    afterMessageId: string | null,
    answer = `answer ${questionId}`,
): TranscriptEntry => ({
    questionId,
    question: `question ${questionId}`,
    answer,
    afterMessageId,
    at: "2026-09-06T00:00:00.000Z",
})

const keys = (items: Array<{ key: string }>) => items.map(item => item.key)

describe("buildTranscript", () => {
    it("places answers after the message they were submitted against", () => {
        const items = buildTranscript(
            [message("m1"), message("m2"), message("m3")],
            [entry("q1", "m2")],
            [],
        )

        expect(keys(items)).toEqual(["m1", "m2", "answer:q1", "m3"])
    })

    it("puts answers submitted before any message at the start", () => {
        const items = buildTranscript([message("m1")], [entry("q1", null)], [])

        expect(keys(items)).toEqual(["answer:q1", "m1"])
    })

    it("keeps several answers from one submission in the order they were recorded", () => {
        const items = buildTranscript(
            [message("m1"), message("m2")],
            [entry("q1", "m1"), entry("q2", "m1")],
            [],
        )

        expect(keys(items)).toEqual(["m1", "answer:q1", "answer:q2", "m2"])
    })

    it("appends answers whose anchor is no longer in the stream", () => {
        const items = buildTranscript([message("m1")], [entry("q1", "gone")], [])

        expect(keys(items)).toEqual(["m1", "answer:q1"])
    })

    it("falls back to backend answered questions that have no record", () => {
        const items = buildTranscript(
            [message("m1")],
            [entry("q1", "m1")],
            [
                { id: "q1", question: "question q1", answer: "answer q1" },
                { id: "legacy", question: "Asked before this history existed?", answer: "Yes." },
            ],
        )

        expect(keys(items)).toEqual(["m1", "answer:q1", "answer:legacy"])
    })

    it("never renders the same question twice", () => {
        const items = buildTranscript(
            [message("m1")],
            [entry("q1", "m1"), entry("q1", null, "a stale duplicate")],
            [{ id: "q1", question: "question q1", answer: "answer q1" }],
        )

        expect(keys(items)).toEqual(["m1", "answer:q1"])
        expect(items[1]).toMatchObject({ answer: "answer q1" })
    })

    it("carries the recorded question and answer text", () => {
        const [item] = buildTranscript([], [entry("q1", null)], [])

        expect(item).toEqual({
            kind: "answer",
            key: "answer:q1",
            question: "question q1",
            answer: "answer q1",
        })
    })
})

describe("dedupeEntries", () => {
    it("keeps the first record for each question id", () => {
        expect(dedupeEntries([entry("q1", null, "first"), entry("q1", "m1", "second")])).toEqual([
            entry("q1", null, "first"),
        ])
    })
})

describe("composer attachments", () => {
    it("shows only files selected for the next message", () => {
        const files = [
            { id: "older", name: "already-sent.pdf" },
            { id: "pending", name: "receipt.png" },
            { id: "generated", name: "summary.pdf" },
        ]

        expect(selectPendingAttachments(files, ["pending"])).toEqual([
            { id: "pending", name: "receipt.png" },
        ])
    })

    it("clears admitted files while preserving attachments selected during submission", () => {
        expect(
            clearSubmittedAttachments(
                ["sent-a", "sent-b", "selected-while-submitting"],
                ["sent-a", "sent-b"],
            ),
        ).toEqual(["selected-while-submitting"])
    })
})

describe("isThinking", () => {
    const assistantWithText = { role: "assistant", parts: [{ type: "text", text: "Hello" }] }
    const assistantEmpty = { role: "assistant", parts: [{ type: "text", text: "" }] }
    const user = { role: "user", parts: [{ type: "text", text: "Hi" }] }

    it("always shows pending work for a submitted turn", () => {
        expect(isThinking("submitted", [])).toBe(true)
        // The previous turn's reply is still the last message here.
        expect(isThinking("submitted", [assistantWithText])).toBe(true)
    })

    it("keeps showing pending work while streaming has produced no text", () => {
        expect(isThinking("streaming", [user])).toBe(true)
        expect(isThinking("streaming", [user, assistantEmpty])).toBe(true)
    })

    it("stops once this turn's assistant text has arrived", () => {
        expect(isThinking("streaming", [user, assistantWithText])).toBe(false)
    })

    it("shows nothing when the agent is idle or has errored", () => {
        expect(isThinking("idle", [user])).toBe(false)
        expect(isThinking("error", [user])).toBe(false)
    })
})

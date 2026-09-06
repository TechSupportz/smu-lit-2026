/**
 * Pure view helpers for the pre-filing conversation. They are kept free of React
 * and of the Flue message type so the ordering and pending-state rules can be
 * tested directly.
 */

/** A durable record of one questionnaire question and the answer the user sent. */
export type TranscriptEntry = {
    questionId: string
    question: string
    answer: string
    /**
     * Id of the last visible message at the moment the answers were submitted.
     * `null` means the answers were sent before any visible message existed.
     */
    afterMessageId: string | null
    at: string
}

export type TranscriptEntryInput = Omit<TranscriptEntry, "at">

export type AnsweredQuestion = { id: string; question: string; answer: string }

export type TranscriptItem<M> =
    | { kind: "message"; key: string; message: M }
    | { kind: "answer"; key: string; question: string; answer: string }

/** Drops repeated question ids, keeping the first record for each question. */
export function dedupeEntries<T extends { questionId: string }>(entries: readonly T[]): T[] {
    const seen = new Set<string>()
    return entries.filter(entry => {
        if (seen.has(entry.questionId)) return false
        seen.add(entry.questionId)
        return true
    })
}

/**
 * Interleaves recorded questionnaire answers into the message stream at the
 * point they were submitted, so the hidden control prompt's reply still reads
 * as a response to them. Answered questions without a record — saved before
 * this history existed, or answered on another device — are appended at the end
 * so nothing silently disappears.
 */
export function buildTranscript<M extends { id: string }>(
    messages: readonly M[],
    entries: readonly TranscriptEntry[],
    answered: readonly AnsweredQuestion[],
): TranscriptItem<M>[] {
    const unique = dedupeEntries(entries)
    const messageIds = new Set(messages.map(message => message.id))
    const anchored = new Map<string, TranscriptEntry[]>()
    const leading: TranscriptEntry[] = []
    const orphaned: TranscriptEntry[] = []
    for (const entry of unique) {
        if (entry.afterMessageId === null) {
            leading.push(entry)
            continue
        }
        if (!messageIds.has(entry.afterMessageId)) {
            orphaned.push(entry)
            continue
        }
        const existing = anchored.get(entry.afterMessageId)
        if (existing) existing.push(entry)
        else anchored.set(entry.afterMessageId, [entry])
    }
    const answerItem = (entry: TranscriptEntry): TranscriptItem<M> => ({
        kind: "answer",
        key: `answer:${entry.questionId}`,
        question: entry.question,
        answer: entry.answer,
    })
    const items: TranscriptItem<M>[] = leading.map(answerItem)
    for (const message of messages) {
        items.push({ kind: "message", key: message.id, message })
        for (const entry of anchored.get(message.id) ?? []) items.push(answerItem(entry))
    }
    items.push(...orphaned.map(answerItem))
    const recorded = new Set(unique.map(entry => entry.questionId))
    for (const question of answered) {
        if (recorded.has(question.id)) continue
        items.push({
            kind: "answer",
            key: `answer:${question.id}`,
            question: question.question,
            answer: question.answer,
        })
    }
    return items
}

type PendingMessage = { role: string; parts: readonly { type: string; text?: string }[] }

/**
 * A submitted turn is always pending: the request is in flight and the message
 * list can still be showing the previous turn's reply. Once the response starts
 * streaming, the indicator is dropped only when this turn's assistant text has
 * actually arrived.
 */
export function isThinking(status: string, messages: readonly PendingMessage[]): boolean {
    if (status === "submitted") return true
    if (status !== "streaming") return false
    const latest = messages[messages.length - 1]
    if (!latest || latest.role === "user") return true
    return !latest.parts.some(part => part.type === "text" && Boolean(part.text?.trim()))
}

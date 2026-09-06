export type MockConversationScenario = {
    id: "haircut" | "standard" | "questionnaire" | "long" | "warning" | "error"
    title: string
    purpose: string
    messages: readonly string[]
}

/**
 * Paste these messages into the composer while the backend's MOCK_DATA_MODE is on.
 * Prefixes are intentionally explicit so ordinary user messages still exercise the
 * repeatable default response cycle.
 */
export const MOCK_CONVERSATION_SCENARIOS: readonly MockConversationScenario[] = [
    {
        id: "haircut",
        title: "Haircut package demo",
        purpose: "Narration for the deterministic seeded case and its generated PDFs.",
        messages: [
            "I went to a salon in Toa Payoh on 23 October 2025 for a simple haircut. I saw a women's haircut advertised at $30. The staff first said a basic haircut would cost $20, but after the service they charged me $100 for a haircut, wash and treatment. I mainly speak Mandarin and understand very little English. I felt pressured, frightened and afraid. I returned the next day for a refund, but we could not agree. I later made a police report, complained to CASE, and filed an SCT claim. I want my $100 refunded.",
        ],
    },
    {
        id: "standard",
        title: "Standard intake",
        purpose: "Short alternating turns for composer, bubble and scroll checks.",
        messages: [
            "I paid a $1,200 deposit for renovation work that never started.",
            "The work was supposed to begin on 12 August 2026.",
            "I asked for a full refund, but the contractor stopped replying.",
        ],
    },
    {
        id: "questionnaire",
        title: "Suggested questionnaire answer",
        purpose: "Creates a persisted question with an editable suggested answer.",
        messages: ["[mock:questionnaire] Show the questionnaire test case."],
    },
    {
        id: "long",
        title: "Long Markdown response",
        purpose: "Exercises streaming, headings, lists, wrapping and conversation scrolling.",
        messages: ["[mock:long] Give me the detailed test response."],
    },
    {
        id: "warning",
        title: "Uncertain date warning",
        purpose: "Exercises a cautionary response without turning it into a hard error.",
        messages: ["[mock:warning] The date may only be an estimate."],
    },
    {
        id: "error",
        title: "Interrupted response",
        purpose: "Exercises the inline agent error and retry affordances.",
        messages: ["[mock:error] Trigger the agent error state."],
    },
] as const

export function getMockScenario(id: MockConversationScenario["id"]): MockConversationScenario {
    const scenario = MOCK_CONVERSATION_SCENARIOS.find(item => item.id === id)
    if (!scenario) throw new Error(`Unknown mock conversation scenario: ${id}`)
    return scenario
}

import { loadPrefilledHaircutPackage } from "./backend"
import { useCase } from "./store"

export type AndreaPrefilledConsole = {
    loadHaircutPackage: () => Promise<{
        caseId: string
        revision: number
        messages: number
        readyForLiveGeneration: true
    }>
}

/**
 * Install browser-console helpers only in an explicitly enabled demo build.
 * The helper seeds the real demo backend before projecting that authoritative
 * case into the persisted frontend store, so subsequent agent and PDF actions
 * stay attached to the same case.
 */
export function installPrefilledConsole(): void {
    const prefilledWindow = window as typeof window & {
        __andreaPrefilled?: AndreaPrefilledConsole
    }
    prefilledWindow.__andreaPrefilled = {
        loadHaircutPackage: async () => {
            const before = useCase.getState()
            before.setAnswers({
                amount: "100",
                eventDate: "2025-10-23",
                respondentInSingapore: "yes",
                category: "unfair",
                consent: false,
            })

            const backendState = await loadPrefilledHaircutPackage(before.backendCreateKey)
            const store = useCase.getState()
            store.syncBackendCase(backendState)
            store.seedPrefilledHaircutConversation()
            store.go("filing")

            return {
                caseId: backendState.case.id,
                revision: backendState.case.revision,
                messages: useCase.getState().localChatMessages.length,
                readyForLiveGeneration: true,
            }
        },
    }
}

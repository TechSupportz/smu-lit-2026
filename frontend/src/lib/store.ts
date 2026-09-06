import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
    initialChecks,
    type Stage,
    type EligibilityAnswers,
    type EligibilityCheck,
    type CaseDetails,
    type CaseFile,
    type CasePrepBundle,
} from "./types"
import {
    frontendCategory,
    frontendChecks,
    type BackendCaseState,
} from "./backend"
import {
    dedupeEntries,
    type LocalChatMessage,
    type TranscriptEntry,
    type TranscriptEntryInput,
} from "./chat-view"

export const prefilledHaircutConversation: LocalChatMessage[] = [
    {
        id: "haircut-demo-assistant-1",
        role: "assistant",
        text: "Take your time, Madam Lim. We can go one step at a time. First, why did you go to the salon that day?",
    },
    {
        id: "haircut-demo-user-1",
        role: "user",
        text: "I just want cut hair only. Outside put lady haircut $30, so I go in lor.",
    },
    {
        id: "haircut-demo-assistant-2",
        role: "assistant",
        text: "Which day was this, and where was the salon? If you do not remember the exact time, an estimate is fine.",
    },
    {
        id: "haircut-demo-user-2",
        role: "user",
        text: "23 October 2025, the neighbourhood shop at Toa Payoh. Morning time, near lunch I think. Receipt put 11.42am.",
    },
    {
        id: "haircut-demo-assistant-3",
        role: "assistant",
        text: "Thank you. I have the date, Toa Payoh outlet and receipt time. Before they started, what price did the staff tell you?",
    },
    {
        id: "haircut-demo-user-3",
        role: "user",
        text: "One girl tell me basic haircut $20. I ask twenty only ah, she say yes yes first.",
    },
    {
        id: "haircut-demo-assistant-4",
        role: "assistant",
        text: "The sign outside showed $30, while the staff member told you $20 for a basic haircut. What happened after that?",
    },
    {
        id: "haircut-demo-user-4",
        role: "user",
        text: "After I sit down, two ladies keep tell me hair very dry, must wash and put treatment. They talk very fast, show me many things. I keep say I come cut only.",
    },
    {
        id: "haircut-demo-assistant-5",
        role: "assistant",
        text: "What language did they use? Did anyone explain the wash, treatment or total price in Mandarin before doing them?",
    },
    {
        id: "haircut-demo-user-5",
        role: "user",
        text: "Mostly English. I Chinese educated, Mandarin then okay. English I know very little only. Nobody explain properly in Mandarin, so many word I don't catch.",
    },
    {
        id: "haircut-demo-assistant-6",
        role: "assistant",
        text: "I’ll record that as your account: you mainly understand Mandarin and say the extra services and total price were not properly explained in a language you understood. Did you agree to a $100 package before the services were done?",
    },
    {
        id: "haircut-demo-user-6",
        role: "user",
        text: "No, $100 package I never agree. I thought still doing the haircut. They wash already, then put something on my hair. I don't know become treatment package.",
    },
    {
        id: "haircut-demo-assistant-7",
        role: "assistant",
        text: "When did you first learn that the total was $100?",
    },
    {
        id: "haircut-demo-user-7",
        role: "user",
        text: "Finish already then cashier say one hundred. I shock, I say why so much, just now say twenty only what.",
    },
    {
        id: "haircut-demo-assistant-8",
        role: "assistant",
        text: "How did the staff respond when you questioned the amount? Please use their approximate words if you remember.",
    },
    {
        id: "haircut-demo-user-8",
        role: "user",
        text: "They say got haircut, wash and treatment, all done already so must pay. Both of them stand there talk to me. Exact words I cannot remember, but meaning is cannot don't pay.",
    },
    {
        id: "haircut-demo-assistant-9",
        role: "assistant",
        text: "What made you feel pressured or afraid at that point?",
    },
    {
        id: "haircut-demo-user-9",
        role: "user",
        text: "I alone and they two people keep talking. My English no good, I don't know how argue. I feel frightened and very paiseh, people around also. So I just pay first.",
    },
    {
        id: "haircut-demo-assistant-10",
        role: "assistant",
        text: "How did you pay, and did the salon give you a receipt?",
    },
    {
        id: "haircut-demo-user-10",
        role: "user",
        text: "I pay $100 cash. They give one receipt. I never read properly there, only later my daughter help me see. Receipt got haircut $30, wash $20 and treatment $50.",
    },
    {
        id: "haircut-demo-assistant-11",
        role: "assistant",
        text: "Did you sign any package agreement or receive anything besides the haircut, wash and treatment shown on that receipt?",
    },
    {
        id: "haircut-demo-user-11",
        role: "user",
        text: "No package paper I remember signing. No product, no future session, nothing to bring home. Only receipt and the service they already do.",
    },
    {
        id: "haircut-demo-assistant-12",
        role: "assistant",
        text: "What happened after you went home on 23 October?",
    },
    {
        id: "haircut-demo-user-12",
        role: "user",
        text: "I tell my daughter I pay one hundred for haircut. She see the receipt and say cannot be like that, maybe I kena pressure. She tell me go back ask refund.",
    },
    {
        id: "haircut-demo-assistant-13",
        role: "assistant",
        text: "When did you return, and what exactly did you ask the salon to do?",
    },
    {
        id: "haircut-demo-user-13",
        role: "user",
        text: "Next day, 24 October, I go back myself. I tell them I only wanted haircut and ask return my $100. I say they never tell me properly before doing.",
    },
    {
        id: "haircut-demo-assistant-14",
        role: "assistant",
        text: "Did the salon offer a full refund, partial refund, credit or another service?",
    },
    {
        id: "haircut-demo-user-14",
        role: "user",
        text: "No full refund. We talk but cannot agree. They don't want give my money back, so I leave. No proper settlement lor.",
    },
    {
        id: "haircut-demo-assistant-15",
        role: "assistant",
        text: "What did you do after the refund discussion failed?",
    },
    {
        id: "haircut-demo-user-15",
        role: "user",
        text: "After that I make police report. I also complain to CASE, then file claim at Small Claims Tribunals. My daughter help me with the English parts.",
    },
    {
        id: "haircut-demo-assistant-16",
        role: "assistant",
        text: "What records do you have that may support your account? It is okay if some details are still unknown.",
    },
    {
        id: "haircut-demo-user-16",
        role: "user",
        text: "I have photo of the outside $30 sign and the $100 receipt. Police and CASE record also should have. Staff names I don't know, only know the Toa Payoh shop.",
    },
    {
        id: "haircut-demo-assistant-17",
        role: "assistant",
        text: "Lastly, what outcome do you want from the salon? Are you asking only for the extra $80, or the full $100 you paid?",
    },
    {
        id: "haircut-demo-user-17",
        role: "user",
        text: "I want full $100 back can. I did not choose this package. If they tell me one hundred from start, I won't do already.",
    },
    {
        id: "haircut-demo-assistant-18",
        role: "assistant",
        text: "I’ve recorded your requested remedy as a full $100 refund. Your account now covers the date and place, the $30 sign, the initial $20 quote, the language difficulty, how the extra services were provided, when you learned the total, why you felt pressured, the cash payment and receipt, your next-day refund request, and the later police, CASE and SCT steps. Please check the case details and the two synthetic demo images before generating the preparation summary.",
    },
]
const makeKey = () =>
    globalThis.crypto?.randomUUID?.() ?? `case-${Date.now()}-${Math.random().toString(36).slice(2)}`
const defaults = () => ({
    stage: "landing" as Stage,
    started: false,
    answers: {
        amount: "",
        eventDate: "",
        respondentInSingapore: "",
        category: "",
        consent: false,
    } as EligibilityAnswers,
    checks: initialChecks.map(c => ({ ...c })),
    details: { respondent: "", summary: "", outcome: "" } as CaseDetails,
    files: [] as CaseFile[],
    checklist: [] as string[],
    grillStarted: false,
    grillComplete: false,
    // Durable record of questionnaire answers and where they belong in the transcript.
    transcriptEntries: [] as TranscriptEntry[],
    localChatMessages: [] as LocalChatMessage[],
    consultationDate: "",
    backendCaseId: null as string | null,
    backendCreateKey: makeKey(),
    backendRevision: null as number | null,
    savedAt: null as string | null,
    casePrep: null as CasePrepBundle | null,
})
type CaseState = ReturnType<typeof defaults> & {
    resume: () => void
    go: (stage: Stage) => void
    start: (category?: string) => void
    setAnswers: (answers: Partial<EligibilityAnswers>) => void
    setChecks: (checks: EligibilityCheck[]) => void
    setDetails: (details: Partial<CaseDetails>) => void
    setBackendCase: (id: string, revision: number) => void
    setCasePrep: (bundle: CasePrepBundle | null) => void
    syncBackendCase: (state: BackendCaseState) => void
    addFile: (file: CaseFile) => void
    updateFile: (id: string, patch: Partial<CaseFile>) => void
    removeFile: (id: string) => void
    toggleItem: (id: string) => void
    setGrillProgress: (started: boolean, complete: boolean) => void
    recordAnsweredQuestions: (entries: TranscriptEntryInput[]) => void
    seedPrefilledHaircutConversation: () => void
    setConsultationDate: (date: string) => void
    reset: () => void
}
const stamp = () => ({ savedAt: new Date().toISOString() })
export const useCase = create<CaseState>()(
    persist(
        (set, get) => ({
            ...defaults(),
            resume: () => {
                const state = get()
                get().go(
                    state.casePrep !== null ||
                    state.files.some(f => f.name.includes("memo") && f.status === "ready")
                        ? "complete"
                        : ["filed", "served", "declaration"].every(id =>
                                state.checklist.includes(id),
                            )
                          ? "preparation"
                          : state.files.some(f => f.name.includes("filing") && f.status === "ready")
                            ? "checkpoint"
                            : "filing",
                )
            },
            go: stage => {
                const state = get()
                const destination = stage === "eligibility" ? "filing" : stage
                const eligible = state.checks.every(c => c.status === "passed")
                if (
                    ["checkpoint", "preparation", "complete"].includes(destination) &&
                    !eligible
                ) {
                    set({ stage: "filing" })
                    return
                }
                if (
                    ["preparation", "complete"].includes(destination) &&
                    !["filed", "served", "declaration"].every(id => state.checklist.includes(id))
                ) {
                    set({ stage: "checkpoint" })
                    return
                }
                set({ stage: destination, ...stamp() })
            },
            start: category => {
                if (category && category !== get().answers.category) get().setAnswers({ category })
                set({ stage: "filing", started: true, ...stamp() })
            },
            setAnswers: answers =>
                set(s => ({
                    answers: { ...s.answers, ...answers },
                    checks: initialChecks.map(c => ({ ...c })),
                    checklist: [],
                    grillStarted: false,
                    grillComplete: false,
                    localChatMessages: [],
                    casePrep: null,
                    ...stamp(),
                })),
            setChecks: checks => set({ checks, ...stamp() }),
            setDetails: details =>
                set(s => ({
                    details: { ...s.details, ...details },
                    grillStarted: false,
                    grillComplete: false,
                    casePrep: null,
                    ...stamp(),
                })),
            setBackendCase: (backendCaseId, backendRevision) =>
                set({ backendCaseId, backendRevision, ...stamp() }),
            setCasePrep: casePrep => set({ casePrep, ...stamp() }),
            syncBackendCase: state =>
                set(current => {
                    if (
                        current.backendCaseId === state.case.id &&
                        current.backendRevision !== null &&
                        state.case.revision < current.backendRevision
                    ) {
                        return current
                    }
                    const respondent = state.parties.find(party => party.role === "RESPONDENT")
                    const category = frontendCategory(state)
                    const backendEvidenceIds = new Set(state.evidence.map(item => item.id))
                    const compiledSnapshots = state.snapshots.filter(snapshot => snapshot.pdfSha256)
                    const backendSnapshotIds = new Set(compiledSnapshots.map(item => item.id))
                    const localFiles = current.files.filter(file => {
                        if (!file.backendSource) return true
                        return file.backendSource.type === "evidence"
                            ? backendEvidenceIds.has(file.backendSource.recordId)
                            : backendSnapshotIds.has(file.backendSource.recordId)
                    })
                    const evidence = state.evidence.map(item => {
                        const existing = localFiles.find(file => file.id === item.id)
                        return {
                            ...existing,
                            id: item.id,
                            name: item.originalFilename,
                            size: item.sizeBytes,
                            kind: "evidence" as const,
                            status: "ready" as const,
                            backendStored: true,
                            backendSource: {
                                caseId: state.case.id,
                                type: "evidence" as const,
                                recordId: item.id,
                            },
                            error: undefined,
                        }
                    })
                    const snapshots = compiledSnapshots.map(snapshot => {
                        const name = `${snapshot.basename}.pdf`
                        const existing = localFiles.find(
                            file =>
                                file.backendSource?.recordId === snapshot.id ||
                                (file.kind === "generated" && file.backendStored && file.name === name),
                        )
                        return {
                            ...existing,
                            id: existing?.id ?? `snapshot:${snapshot.id}`,
                            name,
                            size: existing?.size ?? 0,
                            kind: "generated" as const,
                            status: "ready" as const,
                            backendStored: true,
                            backendSource: {
                                caseId: state.case.id,
                                type: "snapshot" as const,
                                recordId: snapshot.id,
                            },
                            error: undefined,
                        }
                    })
                    const reconciledIds = new Set([
                        ...evidence.map(file => file.id),
                        ...snapshots.map(file => file.id),
                    ])
                    return {
                        answers: {
                            ...current.answers,
                            category,
                            amount:
                                state.case.claimAmountCents === null
                                    ? ""
                                    : String(state.case.claimAmountCents / 100),
                        },
                        checks: frontendChecks(state),
                        details: {
                            respondent: respondent?.name ?? "",
                            summary: state.case.factualSummary ?? "",
                            outcome: state.remedies[0]?.description ?? "",
                        },
                        files: [
                            ...localFiles.filter(
                                file =>
                                    !reconciledIds.has(file.id) &&
                                    !(
                                        file.kind === "generated" &&
                                        file.backendStored &&
                                        compiledSnapshots.some(
                                            snapshot => `${snapshot.basename}.pdf` === file.name,
                                        )
                                    ),
                            ),
                            ...evidence,
                            ...snapshots,
                        ],
                        grillStarted: state.questions.length > 0,
                        grillComplete:
                            state.questions.length > 0 &&
                            state.questions.every(question => question.status !== "OPEN"),
                        casePrep:
                            current.backendRevision !== null &&
                            current.backendRevision !== state.case.revision
                                ? null
                                : current.casePrep,
                        backendCaseId: state.case.id,
                        backendRevision: state.case.revision,
                        ...stamp(),
                    }
                }),
            addFile: file => set(s => ({ files: [...s.files, file], ...stamp() })),
            updateFile: (id, patch) =>
                set(s => ({
                    files: s.files.map(f => (f.id === id ? { ...f, ...patch } : f)),
                    ...stamp(),
                })),
            removeFile: id => set(s => ({ files: s.files.filter(f => f.id !== id), ...stamp() })),
            toggleItem: id =>
                set(s => ({
                    checklist: s.checklist.includes(id)
                        ? s.checklist.filter(x => x !== id)
                        : [...s.checklist, id],
                    ...stamp(),
                })),
            setGrillProgress: (grillStarted, grillComplete) =>
                set({ grillStarted, grillComplete, ...stamp() }),
            recordAnsweredQuestions: entries =>
                set(s => {
                    const known = new Set(s.transcriptEntries.map(entry => entry.questionId))
                    const added = dedupeEntries(entries)
                        .filter(entry => !known.has(entry.questionId))
                        .map(entry => ({ ...entry, at: new Date().toISOString() }))
                    if (added.length === 0) return s
                    return {
                        transcriptEntries: [...s.transcriptEntries, ...added],
                        ...stamp(),
                    }
                }),
            seedPrefilledHaircutConversation: () =>
                set({
                    localChatMessages: prefilledHaircutConversation.map(message => ({ ...message })),
                    ...stamp(),
                }),
            setConsultationDate: consultationDate => set({ consultationDate, ...stamp() }),
            reset: () => set(defaults()),
        }),
        {
            name: "claimguide-case",
            version: 2,
            storage: createJSONStorage(() => localStorage),
            partialize: state =>
                Object.fromEntries(
                    Object.entries(state).filter(([, v]) => typeof v !== "function"),
                ),
            merge: (persisted, current) => {
                const saved = persisted as Partial<CaseState>
                const hasBackend = Boolean(saved.backendCaseId)
                return {
                    ...current,
                    ...saved,
                    transcriptEntries: Array.isArray(saved.transcriptEntries)
                        ? saved.transcriptEntries
                        : [],
                    localChatMessages: Array.isArray(saved.localChatMessages)
                        ? saved.localChatMessages
                        : [],
                    files: (saved.files ?? []).map(f =>
                        f.status === "generating"
                            ? {
                                  ...f,
                                  status: "failed",
                                  error: "Interrupted. Please try generating again.",
                              }
                            : f,
                    ),
                    checks: hasBackend
                        ? (saved.checks ?? initialChecks).map(c =>
                              c.status === "checking" ? { ...c, status: "pending" } : c,
                          )
                        : initialChecks.map(c => ({ ...c })),
                }
            },
        },
    ),
)

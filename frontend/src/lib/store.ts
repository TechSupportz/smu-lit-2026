import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
    initialChecks,
    type Stage,
    type EligibilityAnswers,
    type EligibilityCheck,
    type CaseDetails,
    type CaseFile,
} from "./types"
import {
    frontendCategory,
    frontendChecks,
    type BackendCaseState,
} from "./backend"
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
    consultationDate: "",
    backendCaseId: null as string | null,
    backendCreateKey: makeKey(),
    backendRevision: null as number | null,
    savedAt: null as string | null,
})
type CaseState = ReturnType<typeof defaults> & {
    resume: () => void
    go: (stage: Stage) => void
    start: (category?: string) => void
    setAnswers: (answers: Partial<EligibilityAnswers>) => void
    setChecks: (checks: EligibilityCheck[]) => void
    setDetails: (details: Partial<CaseDetails>) => void
    setBackendCase: (id: string, revision: number) => void
    syncBackendCase: (state: BackendCaseState) => void
    addFile: (file: CaseFile) => void
    updateFile: (id: string, patch: Partial<CaseFile>) => void
    removeFile: (id: string) => void
    toggleItem: (id: string) => void
    setGrillProgress: (started: boolean, complete: boolean) => void
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
                    ...stamp(),
                })),
            setChecks: checks => set({ checks, ...stamp() }),
            setDetails: details =>
                set(s => ({
                    details: { ...s.details, ...details },
                    grillStarted: false,
                    grillComplete: false,
                    ...stamp(),
                })),
            setBackendCase: (backendCaseId, backendRevision) =>
                set({ backendCaseId, backendRevision, ...stamp() }),
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

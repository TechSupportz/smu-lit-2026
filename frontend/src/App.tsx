import { useEffect, useRef, useState } from "react"
import {
    ArrowLeft,
    ArrowUpRight,
    Check,
    ChevronRight,
    Landmark,
    Menu,
    ShieldCheck,
    X,
} from "lucide-react"
import { Button } from "./components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./components/ui/dialog"
import { Landing } from "./components/Landing"
import { Chat } from "./components/Chat"
import { Checkpoint } from "./components/Checkpoint"
import { ProgressPanel } from "./components/ProgressPanel"
import { useCase } from "./lib/store"
import {
    BackendError,
    createBackendPdf,
    deleteBackendCase,
    generateCasePrep,
    getBackendCase,
} from "./lib/backend"
import { teardownCase, type TeardownResult } from "./lib/lifecycle"
import { removeBlob, saveBlob } from "./lib/storage"
import type { Stage } from "./lib/types"
type Confirmation = { mode: "clear" } | { mode: "new"; category?: string }

export default function App() {
    const {
        stage,
        go,
        start,
        started,
        files,
        addFile,
        updateFile,
        reset,
        backendCaseId,
        syncBackendCase,
        setCasePrep,
    } = useCase()
    const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 900)
    const [correctionKey, setCorrectionKey] = useState(0)
    const [error, setError] = useState("")
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
    const [clearing, setClearing] = useState(false)
    const [caseMissing, setCaseMissing] = useState(false)
    // Anything a teardown could not remove, kept until it is retried or dismissed.
    const [leftovers, setLeftovers] = useState<TeardownResult | null>(null)
    const [helpOpen, setHelpOpen] = useState(false)
    // Control that should receive focus once the confirmation dialog closes.
    const focusOnClose = useRef<string | null>(null)
    const stageIndex = ["eligibility", "filing"].includes(stage)
        ? 0
        : stage === "checkpoint"
          ? 1
          : 2
    useEffect(() => {
        const compact = window.matchMedia("(max-width: 900px)")
        const syncPanel = () => setPanelOpen(!compact.matches)
        compact.addEventListener("change", syncPanel)
        return () => compact.removeEventListener("change", syncPanel)
    }, [])
    useEffect(() => {
        if (!backendCaseId) return
        void getBackendCase(backendCaseId)
            .then(state => {
                setCaseMissing(false)
                syncBackendCase(state)
            })
            .catch(error => {
                if (error instanceof BackendError && error.status === 404) {
                    setCaseMissing(true)
                    return
                }
                setError(
                    error instanceof Error
                        ? error.message
                        : "The latest case details could not be loaded.",
                )
            })
    }, [backendCaseId, syncBackendCase])
    async function generate(kind: "filing" | "case-prep") {
        if (kind === "case-prep") {
            if (!backendCaseId)
                throw new Error("Run the eligibility check before preparing your case.")
            try {
                const bundle = await generateCasePrep(backendCaseId)
                setCasePrep(bundle)
                return true
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not prepare your court-day case pack. Please try again."
                setError(message)
                return false
            }
        }
        const id = crypto.randomUUID()
        addFile({
            id,
            name: "pre-filing-summary.pdf",
            size: 0,
            kind: "generated",
            status: "generating",
            backendStored: kind === "filing",
        })
        try {
            if (!backendCaseId)
                throw new Error("Run the eligibility check before preparing the filing summary.")
            const result = await createBackendPdf(backendCaseId)
            await saveBlob(id, result.blob)
            updateFile(id, { name: result.filename, size: result.blob.size, status: "ready" })
            if (result.state) syncBackendCase(result.state)
            return true
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not prepare this PDF. Please try again."
            updateFile(id, { status: "failed", error: message })
            setError(message)
            return false
        }
    }
    async function confirmTeardown() {
        if (!confirmation || clearing) return
        setClearing(true)
        const result = await teardownCase({
            backendCaseId,
            fileIds: files.map(file => file.id),
            deleteCase: deleteCaseIfPresent,
            removeFile: removeBlob,
        })
        reset()
        setCaseMissing(false)
        // A clean teardown says nothing about unrelated errors, so leave them alone.
        setLeftovers(result.problems.length > 0 ? result : null)
        setClearing(false)
        const intent = confirmation
        if (intent.mode === "new") {
            start(intent.category)
            focusOnClose.current = "workspace-back"
        } else {
            focusOnClose.current = "landing-start"
        }
        setConfirmation(null)
    }
    async function retryTeardown() {
        if (!leftovers || clearing) return
        setClearing(true)
        const result = await teardownCase({
            ...leftovers.remaining,
            deleteCase: deleteCaseIfPresent,
            removeFile: removeBlob,
        })
        setLeftovers(result.problems.length > 0 ? result : null)
        setClearing(false)
    }
    async function deleteCaseIfPresent(caseId: string) {
        try {
            await deleteBackendCase(caseId)
        } catch (error) {
            if (error instanceof BackendError && error.status === 404) return
            throw error
        }
    }
    function requestStart(category?: string) {
        if (started) {
            setConfirmation({ mode: "new", category })
            return
        }
        start(category)
    }
    return (
        <div className={`app ${stage === "landing" ? "landing" : "workspace"}`}>
            <div className="preview-bar">
                <span className="preview-dot" />
                INTERNAL DEMO<span className="preview-divider">/</span>
                <span>Nothing is submitted to the court.</span>
            </div>
            <header className="site-header">
                <button
                    className="brand"
                    onClick={() => go("landing")}
                    aria-label="ClaimGuide home"
                >
                    <span className="brand-mark">
                        <Landmark size={22} />
                    </span>
                    ClaimGuide<span className="brand-period">.</span>
                </button>
                <nav aria-label="Main navigation">
                    {stage === "landing" ? (
                        <>
                            <a className="nav-link" href="#how-it-works">
                                How it works
                            </a>
                            <button className="nav-link" onClick={() => setHelpOpen(true)}>
                                About small claims
                                <ArrowUpRight size={13} />
                            </button>
                            <a
                                className="court-link"
                                href="https://www.judiciary.gov.sg/civil/small-claims"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Court resources
                                <ArrowUpRight size={14} />
                            </a>
                            {started && (
                                <Button
                                    variant="ghost"
                                    onClick={() => setConfirmation({ mode: "clear" })}
                                >
                                    Clear case
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="header-save">
                                <Check size={14} />
                                Progress saved locally
                            </span>
                            <Button variant="ghost" onClick={() => go("landing")}>
                                Save & exit
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setConfirmation({ mode: "clear" })}
                            >
                                Clear case
                            </Button>
                            <Button
                                className="mobile-panel-button"
                                variant="outline"
                                size="icon"
                                aria-label="Toggle case panel"
                                aria-expanded={panelOpen}
                                aria-controls="case-panel"
                                onClick={() => setPanelOpen(!panelOpen)}
                            >
                                <Menu size={18} />
                            </Button>
                        </>
                    )}
                </nav>
            </header>
            {caseMissing && (
                <div className="recovery-banner" role="status">
                    <p>
                        This saved case is no longer on the backend, so it cannot be continued. Your
                        local copy is out of date. Starting fresh clears it from this browser.
                    </p>
                    <Button
                        variant="outline"
                        disabled={clearing}
                        onClick={() => setConfirmation({ mode: "new" })}
                    >
                        Start a fresh case
                    </Button>
                </div>
            )}
            {leftovers && (
                <div className="recovery-banner" role="status">
                    <p>
                        {leftovers.problems.join(" ")} Your new case is unaffected, but these leftovers
                        are still there.
                    </p>
                    <Button variant="outline" disabled={clearing} onClick={() => void retryTeardown()}>
                        {clearing ? "Removing…" : "Try removing again"}
                    </Button>
                    <Button variant="ghost" disabled={clearing} onClick={() => setLeftovers(null)}>
                        Dismiss
                    </Button>
                </div>
            )}
            {stage === "landing" ? (
                <Landing onStart={requestStart} caseMissing={caseMissing} />
            ) : (
                <>
                    <div className="journey-bar">
                        <div className="journey-inner">
                            {[
                                { label: "Prepare your claim", stage: "filing" },
                                { label: "File & return", stage: "checkpoint" },
                                { label: "Prepare your case", stage: "preparation" },
                            ].map((item, i) => (
                                <div
                                    className={`journey-step ${i === stageIndex ? "active" : ""} ${i < stageIndex ? "finished" : ""}`}
                                    key={item.label}
                                >
                                    <span aria-hidden="true">
                                        {i < stageIndex ? <Check size={13} /> : i + 1}
                                    </span>
                                    <button
                                        disabled={i > stageIndex}
                                        onClick={() => go(item.stage as Stage)}
                                    >
                                        {item.label}
                                    </button>
                                    {i < 2 && <ChevronRight size={15} />}
                                </div>
                            ))}
                        </div>
                    </div>
                    <main className="workspace-main">
                        <div className="work-column">
                            <button
                                id="workspace-back"
                                className="back-link"
                                onClick={() =>
                                    go(
                                        stage === "eligibility" || stage === "filing"
                                            ? "landing"
                                            : stage === "checkpoint"
                                                ? "filing"
                                                : stage === "preparation"
                                                  ? "checkpoint"
                                                  : "preparation",
                                    )
                                }
                            >
                                <ArrowLeft size={14} />
                                {stage === "eligibility" || stage === "filing"
                                    ? "Back to home"
                                    : stage === "checkpoint"
                                        ? "Back to conversation"
                                        : stage === "preparation"
                                          ? "Back to filing checklist"
                                          : "Back to conversation"}
                            </button>
                            {stage === "eligibility" ||
                            stage === "filing" ||
                            stage === "preparation" ? (
                                <Chat
                                    key={stage}
                                    stage={stage === "preparation" ? "preparation" : "filing"}
                                    correctionKey={correctionKey}
                                    onError={setError}
                                    onGenerate={generate}
                                />
                            ) : (
                                <Checkpoint final={stage === "complete"} onError={setError} />
                            )}
                        </div>
                        <ProgressPanel
                            open={panelOpen}
                            onToggle={() => setPanelOpen(!panelOpen)}
                            onError={setError}
                            onCorrection={() => {
                                setCorrectionKey(k => k + 1)
                                if (window.innerWidth <= 900) setPanelOpen(false)
                            }}
                        />
                    </main>
                </>
            )}
            <footer className="site-footer">
                <div>
                    <span className="footer-brand">ClaimGuide.</span>
                    <p>
                        An independent preparation tool. Not affiliated with the Singapore Courts.
                        <br />
                        General guidance, not legal advice. Official filing takes place in CJTS.
                    </p>
                </div>
                <div className="footer-actions">
                    <a
                        href="https://www.judiciary.gov.sg/civil/small-claims"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Singapore Courts
                        <ArrowUpRight size={13} />
                    </a>
                    <button onClick={() => setHelpOpen(true)}>Privacy & this preview</button>
                    {started && (
                        <button onClick={() => setConfirmation({ mode: "clear" })}>
                            Clear my case
                        </button>
                    )}
                </div>
            </footer>
            {error && (
                <div className="error-toast" role="alert">
                    <span>{error}</span>
                    <button aria-label="Dismiss message" onClick={() => setError("")}>
                        <X size={17} />
                    </button>
                </div>
            )}
            <Dialog
                open={confirmation !== null}
                onOpenChange={open => {
                    if (!open && !clearing) setConfirmation(null)
                }}
            >
                <DialogContent
                    onCloseAutoFocus={event => {
                        const target = focusOnClose.current
                        focusOnClose.current = null
                        const element = target && document.getElementById(target)
                        if (!element) return
                        event.preventDefault()
                        element.focus()
                    }}
                >
                    <DialogTitle>
                        {confirmation?.mode === "new"
                            ? "Start a new case?"
                            : "Clear your saved case?"}
                    </DialogTitle>
                    <DialogDescription>
                        {confirmation?.mode === "new"
                            ? "Starting a new case first removes the case you have saved, including its conversation, answers and files. Download anything you want to keep first. This cannot be undone."
                            : "This removes your conversations, answers and files from this browser. Download anything you want to keep first. This cannot be undone."}
                    </DialogDescription>
                    <div className="dialog-actions">
                        <Button
                            variant="outline"
                            disabled={clearing}
                            onClick={() => setConfirmation(null)}
                        >
                            Keep my case
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={clearing}
                            onClick={() => void confirmTeardown()}
                        >
                            {clearing
                                ? "Clearing…"
                                : confirmation?.mode === "new"
                                  ? "Clear and start new"
                                  : "Clear my case"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogContent>
                    <span className="help-icon">
                        <ShieldCheck size={25} />
                    </span>
                    <DialogTitle>A little clarity about ClaimGuide</DialogTitle>
                    <DialogDescription>
                        ClaimGuide is an independent internal demo for individual claimants
                        preparing for the Small Claims Tribunals.
                    </DialogDescription>
                    <div className="help-copy">
                        <p>
                            Eligibility answers, pre-filing messages, structured case details and
                            attachments are sent to the configured backend. Browser storage keeps UI
                            progress and downloadable copies.
                        </p>
                        <p>
                            This demo has no accounts or user isolation. Use only on localhost or a
                            trusted internal network, and avoid unnecessary sensitive information.
                            “Clear my case” deletes the backend case and local browser copies.
                        </p>
                        <p>
                            Backend checks and generated summaries support preparation only.
                            Complete the court’s official pre-filing assessment and filing steps in
                            CJTS.
                        </p>
                        <a
                            href="https://www.judiciary.gov.sg/civil/cases-eligible-small-claim"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Read the official eligibility criteria
                            <ArrowUpRight size={14} />
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

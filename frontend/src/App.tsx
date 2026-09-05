import { useState } from "react"
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
import { createSamplePdf } from "./lib/demo"
import { createBackendPdf, deleteBackendCase } from "./lib/backend"
import { removeBlob, saveBlob } from "./lib/storage"
import type { Stage } from "./lib/types"
export default function App() {
    const { stage, go, started, files, addFile, updateFile, reset, backendCaseId, setBackendCase } =
        useCase()
    const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 900)
    const [correctionKey, setCorrectionKey] = useState(0)
    const [error, setError] = useState("")
    const [clearOpen, setClearOpen] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [helpOpen, setHelpOpen] = useState(false)
    const stageIndex = ["eligibility", "filing"].includes(stage)
        ? 0
        : stage === "checkpoint"
          ? 1
          : 2
    async function generate(kind: "filing" | "memo") {
        const id = crypto.randomUUID()
        addFile({
            id,
            name: kind === "memo" ? "sample-legal-memo.pdf" : "pre-filing-summary.pdf",
            size: 0,
            kind: "generated",
            status: "generating",
            backendStored: kind === "filing",
        })
        try {
            if (kind === "filing" && !backendCaseId)
                throw new Error("Run the eligibility check before preparing the filing summary.")
            const result =
                kind === "filing"
                    ? await createBackendPdf(backendCaseId!)
                    : {
                          blob: await createSamplePdf(kind),
                          filename: "sample-legal-memo.pdf",
                          state: null,
                      }
            await saveBlob(id, result.blob)
            updateFile(id, { name: result.filename, size: result.blob.size, status: "ready" })
            if (result.state) setBackendCase(result.state.case.id, result.state.case.revision)
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
    async function clear() {
        setClearing(true)
        try {
            if (backendCaseId) await deleteBackendCase(backendCaseId)
            await Promise.all(files.map(f => removeBlob(f.id)))
            reset()
            setClearOpen(false)
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Could not clear all saved case data. Please try again.",
            )
        } finally {
            setClearing(false)
        }
    }
    const resume = useCase(s => s.resume)
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
                            {started ? (
                                <Button variant="outline" onClick={resume}>
                                    Continue my case
                                    <ChevronRight size={15} />
                                </Button>
                            ) : (
                                <a
                                    className="court-link"
                                    href="https://www.judiciary.gov.sg/civil/small-claims"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Court resources
                                    <ArrowUpRight size={14} />
                                </a>
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
                                className="mobile-panel-button"
                                variant="outline"
                                size="icon"
                                aria-label="Toggle case panel"
                                onClick={() => setPanelOpen(!panelOpen)}
                            >
                                <Menu size={18} />
                            </Button>
                        </>
                    )}
                </nav>
            </header>
            {stage === "landing" ? (
                <Landing />
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
                                    <span>{i < stageIndex ? <Check size={13} /> : i + 1}</span>
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
                    {started && <button onClick={() => setClearOpen(true)}>Clear my case</button>}
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
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
                <DialogContent>
                    <DialogTitle>Clear your saved case?</DialogTitle>
                    <DialogDescription>
                        This removes your conversations, answers and files from this browser.
                        Download anything you want to keep first. This cannot be undone.
                    </DialogDescription>
                    <div className="dialog-actions">
                        <Button
                            variant="outline"
                            disabled={clearing}
                            onClick={() => setClearOpen(false)}
                        >
                            Keep my case
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={clearing}
                            onClick={() => void clear()}
                        >
                            {clearing ? "Clearing…" : "Clear my case"}
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

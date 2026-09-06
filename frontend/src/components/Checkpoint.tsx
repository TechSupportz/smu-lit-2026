import { useEffect, useState } from "react"
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    CalendarDays,
    CheckCheck,
    FileText,
    FolderOpen,
    Bookmark,
    ExternalLink,
    MessageCircle,
    Download,
    Eye,
    LoaderCircle,
    PackageOpen,
} from "lucide-react"
import { useCase } from "@/lib/store"
import { checklistItems } from "@/lib/types"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog"
import { FileCard } from "./FileCard"
import {
    downloadCasePrepCueCard,
    downloadCasePrepEvidence,
    downloadCasePrepPrefiling,
    downloadCasePrepStack,
    getCasePrep,
    getCasePrepCueCard,
} from "@/lib/backend"
import type { CasePrepBundle } from "@/lib/types"

function CasePrepAssets({
    bundle,
    loading,
    onPreview,
    onDownloadCueCard,
    onDownloadStack,
    onError,
}: {
    bundle: CasePrepBundle | null
    loading: boolean
    onPreview: () => void
    onDownloadCueCard: () => void
    onDownloadStack: () => void
    onError: (message: string) => void
}) {
    if (loading) {
        return (
            <div className="case-prep-loading" role="status">
                <LoaderCircle size={18} className="spin" />
                Loading your case-prep pack…
            </div>
        )
    }
    if (!bundle) {
        return (
            <div className="case-prep-empty">
                <PackageOpen size={22} />
                <div>
                    <strong>Your case-prep pack is not available yet.</strong>
                    <p>Return to the case-preparation conversation and generate it again.</p>
                </div>
            </div>
        )
    }
    const downloadPrefiling = async () => {
        if (!bundle.prefiling) return
        try {
            await downloadCasePrepPrefiling(bundle.prefiling)
        } catch (error) {
            onError(error instanceof Error ? error.message : "The pre-filing PDF could not be downloaded.")
        }
    }
    const downloadEvidence = async (item: CasePrepBundle["evidence"][number]) => {
        try {
            await downloadCasePrepEvidence(item)
        } catch (error) {
            onError(error instanceof Error ? error.message : "The evidence file could not be downloaded.")
        }
    }
    return (
        <div className="case-prep-assets">
            <div className="section-title-row">
                <div>
                    <h2>Your court-day pack</h2>
                    <p className="section-kicker">Generated from your reviewed case and evidence.</p>
                </div>
                <span>
                    <PackageOpen size={15} />
                    {bundle.evidence.length} {bundle.evidence.length === 1 ? "evidence file" : "evidence files"}
                </span>
            </div>
            <div className="case-prep-hero">
                <div className="case-prep-hero-copy">
                    <span className="case-prep-icon"><FileText size={22} /></span>
                    <div>
                        <strong>One PDF stack for the tribunal</strong>
                        <p>{bundle.stack.pageCount} pages · Includes your pre-filing PDF and all available evidence.</p>
                    </div>
                </div>
                <Button onClick={onDownloadStack}>
                    <Download size={16} />
                    Download full stack
                </Button>
            </div>
            <div className="case-prep-grid">
                <article className="case-prep-card cue-card-card">
                    <div className="case-prep-card-heading">
                        <span className="case-prep-icon soft"><Bookmark size={18} /></span>
                        <div>
                            <h3>Cue card</h3>
                            <p>{bundle.cueCard.pageCount} {bundle.cueCard.pageCount === 1 ? "page" : "pages"} · {bundle.cueCard.filename}</p>
                        </div>
                    </div>
                    <p className="case-prep-card-copy">A compact reminder of your timeline, key points and the outcome you’re asking for.</p>
                    <div className="case-prep-card-actions">
                        <Button variant="outline" onClick={onPreview}>
                            <Eye size={16} /> Preview cue card
                        </Button>
                        <Button variant="ghost" onClick={onDownloadCueCard} aria-label={`Download ${bundle.cueCard.filename}`}>
                            <Download size={16} /> Download
                        </Button>
                    </div>
                </article>
                <article className="case-prep-card">
                    <div className="case-prep-card-heading">
                        <span className="case-prep-icon soft"><FileText size={18} /></span>
                        <div>
                            <h3>Pre-filing form</h3>
                            <p>{bundle.prefiling ? bundle.prefiling.filename : "Not available"}</p>
                        </div>
                    </div>
                    <p className="case-prep-card-copy">Keep the current pre-filing summary with the other documents you bring.</p>
                    {bundle.prefiling ? (
                        <Button variant="outline" onClick={() => void downloadPrefiling()}>
                            <Download size={16} /> Download pre-filing PDF
                        </Button>
                    ) : <span className="case-prep-unavailable">No compiled pre-filing PDF yet.</span>}
                </article>
            </div>
            <div className="case-prep-evidence">
                <div className="section-title-row">
                    <h3>Original evidence files</h3>
                    <span>Download individually</span>
                </div>
                {bundle.evidence.length === 0 ? (
                    <p className="field-hint">No evidence was attached to this case.</p>
                ) : bundle.evidence.map(item => (
                    <div className="case-prep-evidence-row" key={item.id}>
                        <FileText size={17} />
                        <span title={item.originalFilename}>{item.originalFilename}</span>
                        <Button variant="ghost" size="icon" onClick={() => void downloadEvidence(item)} aria-label={`Download ${item.originalFilename}`}>
                            <Download size={16} />
                        </Button>
                    </div>
                ))}
                <p className="field-hint">The full PDF stack is the easiest way to print everything together. Original files are also available above for your records.</p>
            </div>
        </div>
    )
}

export function Checkpoint({
    final = false,
    onError,
}: {
    final?: boolean
    onError: (s: string) => void
}) {
    const {
        files,
        checklist,
        toggleItem,
        consultationDate,
        setConsultationDate,
        go,
        backendCaseId,
        casePrep: savedCasePrep,
        setCasePrep,
    } = useCase()
    const [preview, setPreview] = useState<string | null>(null)
    const [casePrep, setLocalCasePrep] = useState<CasePrepBundle | null>(savedCasePrep)
    const [prepLoading, setPrepLoading] = useState(final && !savedCasePrep && Boolean(backendCaseId))
    const generated = files.filter(f => f.kind === "generated")
    const count = checklistItems.filter(item => checklist.includes(item.id)).length
    const visibleFiles = generated.filter(f => f.name.includes("filing"))
    useEffect(() => {
        setLocalCasePrep(savedCasePrep)
    }, [savedCasePrep])
    useEffect(() => {
        if (!final || !backendCaseId || casePrep) return
        setPrepLoading(true)
        void getCasePrep(backendCaseId)
            .then(bundle => {
                setLocalCasePrep(bundle)
                setCasePrep(bundle)
            })
            .catch(error =>
                onError(
                    error instanceof Error
                        ? error.message
                        : "Your case-prep pack could not be loaded.",
                ),
            )
            .finally(() => setPrepLoading(false))
    }, [backendCaseId, casePrep, final, onError, setCasePrep])
    function closePreview() {
        if (preview) URL.revokeObjectURL(preview)
        setPreview(null)
    }
    async function previewCueCard() {
        if (!backendCaseId) return onError("Your case is not connected to the backend yet.")
        try {
            const blob = await getCasePrepCueCard(backendCaseId)
            setPreview(URL.createObjectURL(blob))
        } catch (error) {
            onError(error instanceof Error ? error.message : "The cue card could not be opened.")
        }
    }
    async function downloadCueCard() {
        if (!casePrep || !backendCaseId) return
        try {
            await downloadCasePrepCueCard(backendCaseId, casePrep.cueCard.filename)
        } catch (error) {
            onError(error instanceof Error ? error.message : "The cue card could not be downloaded.")
        }
    }
    async function downloadStack() {
        if (!casePrep || !backendCaseId) return
        try {
            await downloadCasePrepStack(backendCaseId, casePrep.stack.filename)
        } catch (error) {
            onError(error instanceof Error ? error.message : "The PDF stack could not be downloaded.")
        }
    }
    return (
        <div className="stage-content checkpoint-content">
            <div className="stage-eyebrow">
                {final ? <CheckCheck size={16} /> : <Bookmark size={16} />}{" "}
                {final ? "YOUR PREPARATION PACK" : "STEP 2 · FILE & RETURN"}
            </div>
            <h1>
                {final ? (
                    <>
                        Ready for the day
                        <br />
                        in court.
                    </>
                ) : (
                    <>
                        A good place
                        <br />
                        to pause.
                    </>
                )}
            </h1>
            <p className="stage-description">
                {final
                    ? "Your cue card and complete PDF stack are ready. Download what you need, review the details, and bring the pack with your case papers."
                    : "Your progress is saved. Complete these steps through the court, then come back when you’re ready to prepare your case."}
            </p>
            {!final && (
                <div className="checkpoint-banner">
                    <span className="banner-icon">
                        <Check size={22} />
                    </span>
                    <div>
                        <strong>Your preparation is saved here.</strong>
                        <p>Return on this browser to pick up where you left off.</p>
                    </div>
                    <span className="light-tag">SAVED</span>
                </div>
            )}
            <section className="checkpoint-section">
                {final ? (
                    <CasePrepAssets
                        bundle={casePrep}
                        loading={prepLoading}
                        onPreview={() => void previewCueCard()}
                        onDownloadCueCard={() => void downloadCueCard()}
                        onDownloadStack={() => void downloadStack()}
                        onError={onError}
                    />
                ) : (
                    <>
                        <div className="section-title-row">
                            <h2>Your documents</h2>
                            <span>
                                <FolderOpen size={15} />
                                {visibleFiles.length} {visibleFiles.length === 1 ? "file" : "files"}
                            </span>
                        </div>
                        {visibleFiles.map(f => (
                            <FileCard key={f.id} file={f} onError={onError} />
                        ))}
                        <p className="field-hint">
                            This preparation summary was generated from the backend case. It is not an official court form or evidence of filing.
                        </p>
                    </>
                )}
            </section>
            {!final ? (
                <>
                    <section className="checkpoint-section">
                        <div className="section-title-row">
                            <h2>Before you come back</h2>
                            <span>{count} of 3 complete</span>
                        </div>
                        <div className="readiness-track">
                            <span style={{ width: `${(count / 3) * 100}%` }} />
                        </div>
                        <p className="checklist-explainer">
                            Tick each step after you’ve completed it outside ClaimGuide.
                        </p>
                        <div className="readiness-list">
                            {checklistItems.map((item, i) => (
                                <div
                                    className={`readiness-item ${checklist.includes(item.id) ? "done" : ""}`}
                                    key={item.id}
                                >
                                    <Checkbox
                                        id={item.id}
                                        checked={checklist.includes(item.id)}
                                        onCheckedChange={() => toggleItem(item.id)}
                                    />
                                    <div>
                                        <label htmlFor={item.id}>
                                            <span>{String(i + 1).padStart(2, "0")}</span>
                                            {item.title}
                                        </label>
                                        <p>{item.description}</p>
                                        <a href={item.link} target="_blank" rel="noreferrer">
                                            {item.linkLabel}
                                            <ArrowUpRight size={13} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="court-docs">
                        <FileText size={20} />
                        <div>
                            <h3>Keep your court documents close</h3>
                            <p>
                                Save your claim copies, Notice of Consultation, payment receipt and
                                proof of service. You may also need contracts, receipts,
                                correspondence or other evidence.
                            </p>
                            <a
                                href="https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Check the documents for your claim
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    </section>
                    <div className="date-card">
                        <CalendarDays size={20} />
                        <div>
                            <label htmlFor="consultation-date">
                                Your consultation date <span>Optional</span>
                            </label>
                            <p>Keep a note here when the court gives you a date.</p>
                        </div>
                        <Input
                            id="consultation-date"
                            type="date"
                            value={consultationDate}
                            onChange={e => setConsultationDate(e.target.value)}
                        />
                    </div>
                    <div className="stage-action">
                        <div>
                            <strong>
                                {count === 3
                                    ? "You’re ready for case preparation."
                                    : "One step at a time is enough."}
                            </strong>
                            <p>
                                {count === 3
                                    ? "Continue whenever you feel ready."
                                    : "Complete all three steps to unlock the next conversation."}
                            </p>
                        </div>
                        <Button disabled={count !== 3} onClick={() => go("preparation")}>
                            Prepare my case
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <section className="checkpoint-section">
                        <div className="section-title-row">
                            <h2>A few things to keep in mind</h2>
                            <span>Before your consultation</span>
                        </div>
                        <div className="guidance-list">
                            {[
                                {
                                    icon: FileText,
                                    title: "Review the cue card",
                                    text: "Check the facts, dates and amounts against your own records. The cue card is a reminder, not a script or legal advice.",
                                    href: "https://www.judiciary.gov.sg/civil/before-going-to-court-small-claim",
                                },
                                {
                                    icon: MessageCircle,
                                    title: "Get ready for your consultation",
                                    text: "Be ready to explain what happened and the outcome you’re seeking. Follow your Notice of Consultation and the court’s instructions.",
                                    href: "https://www.judiciary.gov.sg/civil/at-small-claims-consultation",
                                },
                                {
                                    icon: CalendarDays,
                                    title: "Follow the court’s next steps",
                                    text: "If the dispute proceeds to a hearing, follow the directions for evidence, documents and witnesses. Your case may also resolve earlier.",
                                    href: "https://www.judiciary.gov.sg/civil/at-small-claims-hearing",
                                },
                            ].map(({ icon: Icon, title, text, href }) => (
                                <article key={title}>
                                    <span className="guidance-icon">
                                        <Icon size={21} />
                                    </span>
                                    <div>
                                        <h3>{title}</h3>
                                        <p>{text}</p>
                                        <a href={href} target="_blank" rel="noreferrer">
                                            Read the court’s guide
                                            <ArrowUpRight size={13} />
                                        </a>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                    <div className="stage-action">
                        <div>
                            <strong>This is still your space.</strong>
                            <p>Return to the conversation to add updates.</p>
                        </div>
                        <Button variant="outline" onClick={() => go("preparation")}>
                            Back to my conversation
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </>
            )}
            <Dialog
                open={!!preview}
                onOpenChange={open => {
                    if (!open) closePreview()
                }}
            >
                <DialogContent className="pdf-dialog">
                    <DialogTitle>Your tribunal cue card</DialogTitle>
                    <DialogDescription>
                        Review this short reminder before downloading it for your consultation.
                    </DialogDescription>
                    {preview && <iframe title="Tribunal cue card PDF" src={preview} />}
                </DialogContent>
            </Dialog>
        </div>
    )
}

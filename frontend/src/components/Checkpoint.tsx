import { useState } from "react"
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
} from "lucide-react"
import { useCase } from "@/lib/store"
import { checklistItems } from "@/lib/types"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog"
import { readBlob } from "@/lib/storage"
import { FileCard } from "./FileCard"
export function Checkpoint({
    final = false,
    onError,
}: {
    final?: boolean
    onError: (s: string) => void
}) {
    const { files, checklist, toggleItem, consultationDate, setConsultationDate, go } = useCase()
    const [preview, setPreview] = useState<string | null>(null)
    const generated = files.filter(f => f.kind === "generated")
    const count = checklistItems.filter(item => checklist.includes(item.id)).length
    const visibleFiles = generated.filter(f => f.name.includes(final ? "memo" : "filing"))
    const latestMemo = [...generated]
        .reverse()
        .find(f => f.name.includes("memo") && f.status === "ready")
    async function openPreview() {
        if (!latestMemo) return
        try {
            const blob = await readBlob(latestMemo.id)
            if (!blob)
                throw new Error(
                    "The PDF is no longer available on this browser. Return to your conversation and prepare it again.",
                )
            setPreview(URL.createObjectURL(blob))
        } catch (e) {
            onError((e as Error).message)
        }
    }
    function closePreview() {
        if (preview) URL.revokeObjectURL(preview)
        setPreview(null)
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
                        A clearer picture.
                        <br />
                        Your next step awaits.
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
                    ? "Your document is ready. Take a moment to review it, and keep a copy with your case papers."
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
                <div className="section-title-row">
                    <h2>{final ? "Your legal memo" : "Your documents"}</h2>
                    <span>
                        <FolderOpen size={15} />
                        {visibleFiles.length} {visibleFiles.length === 1 ? "file" : "files"}
                    </span>
                </div>
                {visibleFiles.map(f => (
                    <FileCard key={f.id} file={f} onError={onError} />
                ))}
                <p className="field-hint">
                    {final
                        ? "This remains a clearly marked local sample because the current backend is pre-filing only."
                        : "This preparation summary was generated from the backend case. It is not an official court form or evidence of filing."}
                </p>
                {final && latestMemo && (
                    <Button variant="outline" onClick={() => void openPreview()}>
                        <FileText size={16} />
                        Preview PDF
                        <ArrowUpRight size={15} />
                    </Button>
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
                            <span>No more checklists.</span>
                        </div>
                        <div className="guidance-list">
                            {[
                                {
                                    icon: FileText,
                                    title: "Read through your document",
                                    text: "Check the facts, dates and amounts against your own records. Keep your supporting evidence and original documents organised.",
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
                    <DialogTitle>Sample legal memo</DialogTitle>
                    <DialogDescription>
                        Demonstration document only. The backend will supply the actual PDF.
                    </DialogDescription>
                    {preview && <iframe title="Sample legal memo PDF" src={preview} />}
                </DialogContent>
            </Dialog>
        </div>
    )
}

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useFlueAgent } from "@flue/react"
import { createFlueClient } from "@flue/sdk"
import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react"
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming"
import {
    ArrowRight,
    ArrowUp,
    Paperclip,
    MessageCircle,
    FileText,
    Square,
    ShieldCheck,
    LoaderCircle,
} from "lucide-react"
import {
    answerBackendQuestion,
    backendAgentUrl,
    getBackendCase,
    markBackendCaseReviewed,
    uploadBackendEvidence,
    type BackendQuestion,
} from "@/lib/backend"
import { useCase } from "@/lib/store"
import { saveBlob } from "@/lib/storage"
import { useAutoGrow } from "@/lib/autogrow"
import {
    buildTranscript,
    clearSubmittedAttachments,
    isThinking,
    selectPendingAttachments,
} from "@/lib/chat-view"
import type { ChatStage } from "@/lib/types"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { FileCard } from "./FileCard"
import { Eligibility } from "./Eligibility"
import { GrillQuestionnaire } from "./CaseQuestionnaire"

const INITIAL_CHAT_PROMPT =
    "Read the current case and conversation. Continue intake with the next useful question, choosing the best response format according to the harness guidelines."
// Keep the previous automatic message hidden in saved conversations.
const LEGACY_INITIAL_CHAT_PROMPT =
    "Read the current case and conversation. Ask the next useful intake or follow-up question using add_open_question with a suggestedAnswer. The question will be rendered as an interactive questionnaire; do not repeat it as chat text. Reuse an existing open question if present."
export const PREPARE_PREFILING_PROMPT =
    "[andrea-action:prepare-prefiling] The user selected Prepare filing summary. Read the authoritative case state, run save_final_prefiling_state with the current revision, then run compile_snapshot_pdf for the snapshot returned by that tool. Do not invent or silently change case facts. Confirm only after both tools succeed."
export const PREPARE_CASE_PACK_PROMPT =
    "[andrea-action:prepare-case-pack] The user selected Prepare my case pack. Read the authoritative case state, then run prepare_tribunal_case_pack with the current revision. Do not invent or silently change case facts. Confirm only after the tool succeeds."
const streamingMarkdownExtensions = [streamingMarkdownExtension()]
const markdownComponents = {
    a(props) {
        const external = /^https?:\/\//i.test(props.href ?? "")
        return (
            <a
                {...props}
                rel={external ? "nofollow noopener noreferrer" : props.rel}
                target={external ? "_blank" : props.target}
            />
        )
    },
} satisfies MarkdownComponents

function isInitialPrompt(message: { role: string; parts: Array<{ type: string; text?: string }> }) {
    return (
        message.role === "user" &&
        message.parts.some(part => part.type === "text" && (
            part.text === INITIAL_CHAT_PROMPT ||
            part.text === LEGACY_INITIAL_CHAT_PROMPT ||
            part.text === PREPARE_PREFILING_PROMPT ||
            part.text === PREPARE_CASE_PACK_PROMPT ||
            part.text === "Start the pre-filing conversation. Read the current case state and ask the single most useful focused question." ||
            part.text?.startsWith("I have submitted my questionnaire answers. Read the answered questions,")
        ))
    )
}

function MarkdownMessage({ text, streaming }: { text: string; streaming: boolean }) {
    return (
        <div className="markdown-response">
            <Markdown
                allowHtml={false}
                frontmatter={false}
                headingIds={false}
                components={markdownComponents}
                extensions={streaming ? streamingMarkdownExtensions : undefined}
            >
                {text}
            </Markdown>
        </div>
    )
}

export function Chat({
    stage,
    correctionKey,
    onError,
    onGenerate,
}: {
    stage: ChatStage
    correctionKey: number
    onError: (s: string) => void
    onGenerate: (
        kind: "filing" | "case-prep",
        baseline: { snapshotIds: string[]; casePrepFilename: string | null },
    ) => Promise<boolean>
}) {
    const {
        checks,
        details,
        files,
        go,
        backendCaseId,
        syncBackendCase,
        transcriptEntries,
        localChatMessages,
        casePrep,
        recordAnsweredQuestions,
    } = useCase()
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([])
    const [questions, setQuestions] = useState<BackendQuestion[]>([])
    const isPrep = stage === "preparation"
    const eligible = checks.every(check => check.status === "passed")
    const client = useMemo(
        () =>
            backendCaseId
                ? createFlueClient({ url: backendAgentUrl(backendCaseId) })
                : undefined,
        [backendCaseId],
    )
    const agent = useFlueAgent({ client })
    const backendMessages = agent.messages.filter(
        message =>
            message.display === "visible" &&
            !isInitialPrompt(message) &&
            message.parts.some(part => part.type === "text" && Boolean(part.text?.trim())),
    )
    const messages = [
        ...localChatMessages.map(message => ({
            id: message.id,
            role: message.role,
            display: "visible" as const,
            parts: [{ type: "text" as const, text: message.text, state: "complete" as const }],
        })),
        ...backendMessages,
    ]
    const isLoading = agent.status === "submitted" || agent.status === "streaming"
    // Derived from the raw message list so a hidden control prompt still counts as
    // a pending turn, and so a submitted turn stays pending even while the previous
    // turn's reply is still the last message.
    const thinking = isThinking(agent.status, agent.messages)
    const openQuestions = questions.filter(question => question.status === "OPEN")
    const answeredQuestions = questions.filter(
        question => question.status === "ANSWERED" && question.answer,
    )
    const pendingAttachments = selectPendingAttachments(files, pendingAttachmentIds)
    const showEligibility = !isPrep && !eligible
    const transcript = buildTranscript(
        messages,
        transcriptEntries,
        answeredQuestions.map(question => ({
            id: question.id,
            question: question.question,
            answer: question.answer!,
        })),
    )
    const blockers = isPrep
        ? []
        : [
              !details.respondent.trim() && "who you are claiming against",
              !details.summary.trim() && "a short summary of what happened",
              !details.outcome.trim() && "the outcome you are asking for",
              openQuestions.length > 0 && "your answers to the questions above",
          ].filter((reason): reason is string => typeof reason === "string")
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const uploadRef = useRef<HTMLInputElement>(null)
    const endRef = useRef<HTMLDivElement>(null)
    const initialPromptSent = useRef(false)
    useAutoGrow(inputRef, draft, 200)
    useEffect(() => {
        if (correctionKey) {
            setDraft("I’d like to correct my case details: ")
            inputRef.current?.focus()
        }
    }, [correctionKey])
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "nearest" })
    }, [agent.messages.length, questions.length])
    useEffect(() => {
        if (
            isPrep ||
            !eligible ||
            !client ||
            !agent.historyReady ||
            agent.status !== "idle" ||
            initialPromptSent.current
        )
            return
        // Hydrated history means this case has already received its opening turn.
        // Do not repeat it on reload, stage remounts, or development hot reload.
        if (agent.messages.length > 0) {
            initialPromptSent.current = true
            return
        }
        if (localChatMessages.length > 0) {
            initialPromptSent.current = true
            return
        }
        initialPromptSent.current = true
        void getBackendCase(backendCaseId!).then(state => {
            if (state.questions.some(question => question.status === "OPEN")) return
            if (["READY", "READY_WITH_WARNINGS"].includes(state.case.preparationStatus)) return
            return agent.sendMessage(INITIAL_CHAT_PROMPT)
        }).then(refreshQuestions).catch(error =>
            onError(
                error instanceof Error
                    ? error.message
                    : "The conversation could not be started.",
            ),
        )
    }, [agent, client, eligible, isPrep, onError, backendCaseId, localChatMessages.length])

    useEffect(() => {
        if (!backendCaseId || isPrep || agent.status !== "idle") return
        void refreshQuestions().catch(error =>
            onError(
                error instanceof Error
                    ? error.message
                    : "The Grill Me questions could not be refreshed.",
            ),
        )
    }, [agent.status, backendCaseId, isPrep, messages.length])

    async function refreshQuestions() {
        if (!backendCaseId) return
        const state = await getBackendCase(backendCaseId)
        syncBackendCase(state)
        setQuestions(state.questions)
    }

    async function upload(fileList: FileList | null) {
        if (!fileList || !backendCaseId || isPrep) return
        setUploading(true)
        try {
            for (const file of Array.from(fileList)) {
                if (
                    !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
                    file.size > 5 * 1024 * 1024
                ) {
                    onError(`${file.name}: choose a PDF, JPG or PNG no larger than 5 MB.`)
                    continue
                }
                const state = await uploadBackendEvidence(backendCaseId, file)
                const evidence = [...state.evidence]
                    .reverse()
                    .find(
                        item => item.originalFilename === file.name && item.sizeBytes === file.size,
                    )
                if (!evidence)
                    throw new Error(
                        `The backend accepted ${file.name}, but did not return its file record.`,
                    )
                await saveBlob(evidence.id, file)
                syncBackendCase(state)
                setPendingAttachmentIds(current =>
                    current.includes(evidence.id) ? current : [...current, evidence.id],
                )
            }
        } catch (error) {
            onError(
                error instanceof Error ? error.message : "The attachment could not be uploaded.",
            )
        } finally {
            setUploading(false)
            if (uploadRef.current) uploadRef.current.value = ""
        }
    }

    async function send() {
        const outgoing = draft
        const message = outgoing.trim()
        if (!message || isLoading || isPrep) return
        const submittedAttachmentIds = pendingAttachmentIds
        setDraft("")
        let sent = false
        try {
            await agent.sendMessage(message)
            sent = true
            setPendingAttachmentIds(current =>
                clearSubmittedAttachments(current, submittedAttachmentIds),
            )
            await refreshQuestions()
        } catch (error) {
            // Give the message back, unless the user has already typed a replacement.
            if (!sent) setDraft(current => (current === "" ? outgoing : current))
            onError(error instanceof Error ? error.message : "The message could not be sent.")
        }
    }

    async function submitGrill(questionAnswers: Record<string, string>) {
        if (!backendCaseId) return
        setBusy(true)
        // The answers belong after everything the user can currently see, so the
        // reply to the hidden control prompt reads as a response to them.
        const afterMessageId = messages[messages.length - 1]?.id ?? null
        const asked = new Map(openQuestions.map(question => [question.id, question.question]))
        try {
            let state = await getBackendCase(backendCaseId)
            const recorded: Array<{
                questionId: string
                question: string
                answer: string
                afterMessageId: string | null
            }> = []
            for (const [questionId, answer] of Object.entries(questionAnswers)) {
                state = await answerBackendQuestion(backendCaseId, questionId, answer)
                recorded.push({
                    questionId,
                    question: asked.get(questionId) ?? "",
                    answer,
                    afterMessageId,
                })
            }
            recordAnsweredQuestions(recorded)
            syncBackendCase(state)
            setQuestions(state.questions)
            await agent.sendMessage(
                "I have submitted my questionnaire answers. Read the answered questions, update the relevant case summary, parties and remedies from my answers, and continue with the next useful response. Choose the best response format according to the harness guidelines.",
            )
            await refreshQuestions()
        } catch (error) {
            onError(error instanceof Error ? error.message : "The questionnaire could not be saved.")
            throw error
        } finally {
            setBusy(false)
        }
    }

    async function finish() {
        if (busy || isLoading || uploading) return
        setBusy(true)
        try {
            if (!backendCaseId || !client || !agent.historyReady) {
                throw new Error("The agent is not connected to this case yet. Please try again.")
            }
            const kind = isPrep ? "case-prep" : "filing"
            const current = isPrep
                ? await getBackendCase(backendCaseId)
                : await markBackendCaseReviewed(backendCaseId)
            syncBackendCase(current)
            const baseline = {
                snapshotIds: current.snapshots
                    .filter(snapshot => snapshot.pdfSha256)
                    .map(snapshot => snapshot.id),
                casePrepFilename: casePrep?.cueCard.filename ?? null,
            }
            await agent.sendMessage(
                isPrep ? PREPARE_CASE_PACK_PROMPT : PREPARE_PREFILING_PROMPT,
            )
            const success = await onGenerate(kind, baseline)
            if (success) go(isPrep ? "complete" : "checkpoint")
        } catch (error) {
            onError(error instanceof Error ? error.message : "The case could not be prepared.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="stage-content chat-content">
            <div className="stage-eyebrow">
                {isPrep ? <FileText size={16} /> : showEligibility ? (
                    <ShieldCheck size={16} />
                ) : (
                    <MessageCircle size={16} />
                )}{" "}
                {isPrep
                    ? "STEP 3 · PREPARE YOUR CASE"
                    : showEligibility
                      ? "STEP 1 · CHECK WHERE YOU STAND"
                      : "STEP 1 · PREPARE YOUR CLAIM"}
            </div>
            <h1>
                {isPrep ? (
                    <>
                        Your story.
                        <br />
                        Ready for the next chapter.
                    </>
                ) : showEligibility ? (
                    <>
                        First, let’s check
                        <br />
                        where you stand.
                    </>
                ) : (
                    <>
                        Let’s put your
                        <br />
                        story together.
                    </>
                )}
            </h1>
            <p className="stage-description">
                {isPrep
                    ? "Turn your case details and supporting documents into a practical pack for your tribunal consultation."
                    : showEligibility
                      ? "A few short questions tell us whether the Small Claims Tribunals can hear your claim. We’ll start on your story straight afterwards."
                      : "We’ll gather the details, one piece at a time. No legal language needed."}
            </p>
            <div className="conversation">
                {showEligibility ? (
                    <Eligibility embedded onError={onError} />
                ) : (
                    <>
                        {/* Only the message stream is a live region: the eligibility form
                            and the questionnaire own their own announcements. */}
                        <div
                            className="message-stream"
                            aria-label="Conversation"
                            role="log"
                            aria-live="polite"
                            aria-relevant="additions text"
                        >
                            <div className="assistant-intro">
                                <span className="assistant-avatar">
                                    <MessageCircle size={18} />
                                </span>
                                <div>
                                    <strong>Andrea</strong>
                                    <p>
                                        {isPrep
                                            ? "When you’re ready, we’ll create a cue card for the consultation and one PDF stack containing your pre-filing summary and evidence."
                                            : "Start with who you’re claiming against and what happened. You can add receipts, messages, or other supporting documents along the way."}
                                    </p>
                                </div>
                            </div>
                            {transcript.map(item =>
                                item.kind === "message" ? (
                                    <div
                                        className={`message ${item.message.role === "user" ? "user-message" : "assistant-message"}`}
                                        key={item.key}
                                    >
                                        {item.message.role !== "user" && (
                                            <span className="assistant-avatar">
                                                <MessageCircle size={16} />
                                            </span>
                                        )}
                                        <div>
                                            {item.message.parts.map((part, index) =>
                                                part.type === "text" ? (
                                                    item.message.role === "user" ? (
                                                        <p key={index}>{part.text}</p>
                                                    ) : (
                                                        <MarkdownMessage
                                                            key={index}
                                                            text={part.text}
                                                            streaming={part.state === "streaming"}
                                                        />
                                                    )
                                                ) : null,
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Fragment key={item.key}>
                                        <div className="message assistant-message answered-question">
                                            <span className="assistant-avatar">
                                                <MessageCircle size={16} />
                                            </span>
                                            <div>
                                                <small>Questionnaire</small>
                                                <p>{item.question}</p>
                                            </div>
                                        </div>
                                        <div className="message user-message answered-answer">
                                            <div>
                                                <p>{item.answer}</p>
                                            </div>
                                        </div>
                                    </Fragment>
                                ),
                            )}
                            {thinking && (
                                <div className="message assistant-message thinking-message">
                                    <span className="assistant-avatar">
                                        <MessageCircle size={16} />
                                    </span>
                                    <div>
                                        <span className="thinking-dots" aria-hidden="true">
                                            <i />
                                            <i />
                                            <i />
                                        </span>
                                        <span>Andrea is thinking</span>
                                    </div>
                                </div>
                            )}
                            {agent.status === "error" && (
                                <div className="inline-error" role="alert">
                                    {agent.error?.message ??
                                        "The response was interrupted. Your admitted messages remain on the backend."}
                                </div>
                            )}
                        </div>
                        {!isPrep && openQuestions.length > 0 && (
                            <GrillQuestionnaire
                                questions={openQuestions}
                                busy={busy || isLoading}
                                onSubmit={submitGrill}
                            />
                        )}
                        <div ref={endRef} />
                    </>
                )}
            </div>
            {!isPrep && eligible && pendingAttachments.length > 0 && (
                <div className="attachments-area">
                    {pendingAttachments.map(file => (
                        <FileCard key={file.id} file={file} compact onError={onError} />
                    ))}
                </div>
            )}
            {(isPrep || eligible) && (
                <div className="composer-wrap">
                    <form
                        className="composer"
                        onSubmit={event => {
                            event.preventDefault()
                            void send()
                        }}
                    >
                        <Textarea
                            ref={inputRef}
                            aria-label="Message Andrea"
                            placeholder={
                                isPrep
                                    ? "Case preparation is ready when you are"
                                    : "Tell us a little more, or ask a question…"
                            }
                            disabled={isPrep || !backendCaseId}
                            value={draft}
                            onChange={event => setDraft(event.target.value)}
                            onKeyDown={event => {
                                if (
                                    event.key === "Enter" &&
                                    !event.shiftKey &&
                                    !event.nativeEvent.isComposing
                                ) {
                                    event.preventDefault()
                                    void send()
                                }
                            }}
                        />
                        <div className="composer-actions">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={uploading || isPrep || !backendCaseId}
                                onClick={() => uploadRef.current?.click()}
                            >
                                {uploading ? (
                                    <LoaderCircle size={16} className="spin" />
                                ) : (
                                    <Paperclip size={16} />
                                )}
                                Attach a file
                            </Button>
                            <span>PDF, images, text, Word and Office · up to 10 MB</span>
                            {isLoading ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    aria-label="Stop response"
                                    onClick={() =>
                                        void client
                                            ?.abort()
                                            .catch(error =>
                                                onError(
                                                    error instanceof Error
                                                        ? error.message
                                                        : "The response could not be stopped.",
                                                ),
                                            )
                                    }
                                >
                                    <Square size={14} />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    size="icon"
                                    aria-label="Send message"
                                    disabled={isPrep || !draft.trim() || !backendCaseId}
                                >
                                    <ArrowUp size={18} />
                                </Button>
                            )}
                        </div>
                        <input
                            className="sr-only"
                            ref={uploadRef}
                            tabIndex={-1}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx,.rtf,.odt,.ppt,.pptx,.xls,.xlsx"
                            onChange={event => void upload(event.target.files)}
                        />
                    </form>
                    <p className="composer-note">
                        {isPrep
                            ? "Your case-prep pack is generated from the details and evidence in this case."
                            : "Messages and attachments are sent to the configured Andrea backend."}
                    </p>
                </div>
            )}
            {(isPrep || eligible) && (
                <div className="stage-action">
                    <div>
                        <strong>
                            {isPrep
                                ? "Ready to prepare your court-day pack?"
                                : "Happy with your starting details?"}
                        </strong>
                        <p>
                            {isPrep
                                ? "Create a cue card and a single PDF containing the documents you’ve gathered."
                                : "Create a backend-generated pre-filing summary, then review the external filing checklist."}
                        </p>
                        {blockers.length > 0 && (
                            <div className="stage-action-reason" id="prepare-blockers">
                                Before we can prepare this, we still need:
                                <ul>
                                    {blockers.map(reason => (
                                        <li key={reason}>{reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <Button
                        aria-describedby={blockers.length > 0 ? "prepare-blockers" : undefined}
                        disabled={busy || isLoading || uploading || blockers.length > 0}
                        onClick={() => void finish()}
                    >
                        {busy ? (
                            <>
                                <LoaderCircle size={16} className="spin" />
                                Preparing…
                            </>
                        ) : (
                            <>
                                {isPrep ? "Prepare my case pack" : "Prepare filing summary"}
                                <ArrowRight size={16} />
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}

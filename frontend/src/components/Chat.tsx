import { useEffect, useMemo, useRef, useState } from "react"
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
    LoaderCircle,
} from "lucide-react"
import {
    answerBackendQuestion,
    backendAgentUrl,
    getBackendCase,
    uploadBackendEvidence,
    type BackendQuestion,
} from "@/lib/backend"
import { useCase } from "@/lib/store"
import { saveBlob } from "@/lib/storage"
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
    onGenerate: (kind: "filing" | "memo") => Promise<boolean>
}) {
    const {
        checks,
        details,
        files,
        go,
        backendCaseId,
        syncBackendCase,
    } = useCase()
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [questions, setQuestions] = useState<BackendQuestion[]>([])
    const isPrep = stage === "preparation"
    const eligible = checks.every(check => check.status === "passed")
    const client = useMemo(
        () =>
            !isPrep && backendCaseId
                ? createFlueClient({ url: backendAgentUrl(backendCaseId) })
                : undefined,
        [backendCaseId, isPrep],
    )
    const agent = useFlueAgent({ client })
    const messages = agent.messages.filter(
        message => message.display === "visible" && !isInitialPrompt(message),
    )
    const isLoading = agent.status === "submitted" || agent.status === "streaming"
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const uploadRef = useRef<HTMLInputElement>(null)
    const endRef = useRef<HTMLDivElement>(null)
    const initialPromptSent = useRef(false)
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
    }, [agent, client, eligible, isPrep, onError, backendCaseId])

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
        const message = draft.trim()
        if (!message || isLoading || isPrep) return
        setDraft("")
        try {
            await agent.sendMessage(message)
            await refreshQuestions()
        } catch (error) {
            onError(error instanceof Error ? error.message : "The message could not be sent.")
        }
    }

    async function submitGrill(questionAnswers: Record<string, string>) {
        if (!backendCaseId) return
        setBusy(true)
        try {
            let state = await getBackendCase(backendCaseId)
            for (const [questionId, answer] of Object.entries(questionAnswers)) {
                state = await answerBackendQuestion(backendCaseId, questionId, answer)
            }
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
            const success = await onGenerate(isPrep ? "memo" : "filing")
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
                {isPrep ? <FileText size={16} /> : <MessageCircle size={16} />}{" "}
                {isPrep ? "STEP 3 · PREPARE YOUR CASE" : "STEP 1 · PREPARE YOUR CLAIM"}
            </div>
            <h1>
                {isPrep ? (
                    <>
                        Your story.
                        <br />
                        Ready for the next chapter.
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
                    ? "The current backend stops at pre-filing preparation. This stage remains a local preview."
                    : "We’ll gather the details, one piece at a time. No legal language needed."}
            </p>
            <div className="conversation" aria-label="Conversation">
                {!isPrep && !eligible ? (
                    <Eligibility embedded onError={onError} />
                ) : (
                    <>
                        <div className="assistant-intro">
                            <span className="assistant-avatar">
                                <MessageCircle size={18} />
                            </span>
                            <div>
                                <strong>ClaimGuide</strong>
                                <p>
                                    {isPrep
                                        ? "Post-filing case preparation is not connected yet. You can still produce the clearly marked sample memo below."
                                        : "Start with who you’re claiming against and what happened. You can add receipts, messages, or other supporting documents along the way."}
                                </p>
                            </div>
                        </div>
                        {messages.map(message => (
                            <div
                                className={`message ${message.role === "user" ? "user-message" : "assistant-message"}`}
                                key={message.id}
                            >
                                {message.role !== "user" && (
                                    <span className="assistant-avatar">
                                        <MessageCircle size={16} />
                                    </span>
                                )}
                                <div>
                                    {message.parts.map((part, index) =>
                                        part.type === "text" ? (
                                            message.role === "user" ? (
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
                        ))}
                        {isLoading && (
                            <span className="stream-indicator" role="status">
                                <i />
                                <i />
                                <i />
                                ClaimGuide is responding
                            </span>
                        )}
                        {agent.status === "error" && (
                            <div className="inline-error" role="alert">
                                {agent.error?.message ??
                                    "The response was interrupted. Your admitted messages remain on the backend."}
                            </div>
                        )}
                        {!isPrep && questions.some(question => question.status === "OPEN") && (
                            <GrillQuestionnaire
                                key={questions.filter(question => question.status === "OPEN").map(question => question.id).join(":")}
                                questions={questions.filter(question => question.status === "OPEN")}
                                busy={busy || isLoading}
                                onSubmit={submitGrill}
                            />
                        )}
                        <div ref={endRef} />
                    </>
                )}
            </div>
            {(isPrep || eligible) && (
                <div className="attachments-area">
                    {files
                        .filter(file => file.kind === "evidence")
                        .map(file => (
                            <FileCard key={file.id} file={file} onError={onError} />
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
                            aria-label="Message ClaimGuide"
                            placeholder={
                                isPrep
                                    ? "Post-filing assistant not connected"
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
                            <span>PDF, JPG, PNG · up to 5 MB</span>
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
                            accept="application/pdf,image/jpeg,image/png"
                            onChange={event => void upload(event.target.files)}
                        />
                    </form>
                    <p className="composer-note">
                        {isPrep
                            ? "This post-filing stage is not sent to the pre-filing backend."
                            : "Messages and attachments are sent to the configured ClaimGuide backend."}
                    </p>
                </div>
            )}
            {(isPrep || eligible) && (
                <div className="stage-action">
                    <div>
                        <strong>
                            {isPrep
                                ? "Ready to see the preview document?"
                                : "Happy with your starting details?"}
                        </strong>
                        <p>
                            {isPrep
                                ? "Create a clearly marked local sample PDF."
                                : "Create a backend-generated pre-filing summary, then review the external filing checklist."}
                        </p>
                    </div>
                    <Button
                        disabled={
                            busy ||
                            isLoading ||
                            uploading ||
                            (!isPrep &&
                                (!details.summary.trim() ||
                                    !details.respondent.trim() ||
                                    !details.outcome.trim() ||
                                    questions.some(question => question.status === "OPEN")))
                        }
                        onClick={() => void finish()}
                    >
                        {busy ? (
                            <>
                                <LoaderCircle size={16} className="spin" />
                                Preparing…
                            </>
                        ) : (
                            <>
                                {isPrep ? "Prepare sample PDF" : "Prepare filing summary"}
                                <ArrowRight size={16} />
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}

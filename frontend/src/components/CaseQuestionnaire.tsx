import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ComponentProps,
    type CSSProperties,
    type FormEvent,
    type Ref,
} from "react"
import { Questionnaire } from "@shadcn/react/questionnaire"
import { ArrowLeft, ArrowRight, Check, Lightbulb, LoaderCircle, PencilLine } from "lucide-react"
import { useAutoGrow } from "@/lib/autogrow"
import type { BackendQuestion } from "@/lib/backend"

const ANSWER_MAX_HEIGHT = 192

type Question = {
    name: string
    prompt: string
    description: string
    suggestion: string | null
    current: string
}

function AnswerField({
    label,
    value,
    disabled,
    focusTick,
    onChange,
}: {
    label: string
    value: string
    disabled: boolean
    focusTick: number
    onChange: (value: string) => void
}) {
    const field = useRef<HTMLTextAreaElement>(null)
    const fieldId = useId()
    useAutoGrow(field, value, ANSWER_MAX_HEIGHT)
    useEffect(() => {
        if (!focusTick) return
        const element = field.current
        if (!element) return
        element.focus()
        element.setSelectionRange(element.value.length, element.value.length)
    }, [focusTick])
    // The questionnaire registers this control by the element its own ref receives,
    // so the rendered textarea must get both refs or the answer never registers and
    // a freeform-only question can never satisfy its required check.
    const attachField = useCallback((element: HTMLTextAreaElement | null) => {
        field.current = element
    }, [])
    return (
        <div className="questionnaire-freeform">
            <label htmlFor={fieldId}>{label}</label>
            <Questionnaire.Input
                disabled={disabled}
                value={value}
                onChange={event => onChange(event.target.value)}
                placeholder="Type your answer…"
                render={props => {
                    const {
                        type: _type,
                        id: _id,
                        ref: providedRef,
                        ...rest
                    } = props as ComponentProps<"textarea"> & {
                        type?: string
                        ref?: Ref<HTMLTextAreaElement>
                    }
                    return (
                        <textarea
                            {...rest}
                            id={fieldId}
                            ref={element => {
                                attachField(element)
                                if (typeof providedRef === "function") providedRef(element)
                                else if (providedRef) providedRef.current = element
                            }}
                            rows={2}
                        />
                    )
                }}
            />
        </div>
    )
}

function QuestionFlow({
    questions,
    submitLabel,
    busy,
    onSubmit,
}: {
    questions: Question[]
    submitLabel: string
    busy: boolean
    onSubmit: (answers: Record<string, string>) => Promise<void>
}) {
    const [submitting, setSubmitting] = useState(false)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const [editTicks, setEditTicks] = useState<Record<string, number>>({})
    const disabled = busy || submitting
    const items = useMemo(
        () =>
            questions.map(question => ({
                name: question.name,
                required: true,
                disabled,
                choices: question.suggestion ? [{ value: question.suggestion }] : [],
            })),
        [questions, disabled],
    )

    // Background case refreshes replace the question array. Keep draft state for
    // questions that are still open instead of remounting the whole form.
    const openIds = questions.map(question => question.name).join(" ")
    useEffect(() => {
        const ids = new Set(openIds.split(" "))
        const prune = <T,>(value: Record<string, T>) => {
            const kept = Object.entries(value).filter(([id]) => ids.has(id))
            return kept.length === Object.keys(value).length
                ? value
                : (Object.fromEntries(kept) as Record<string, T>)
        }
        setDrafts(prune)
        setSelected(prune)
        setEditTicks(prune)
    }, [openIds])

    const answerFor = (question: Question) =>
        selected[question.name] && question.suggestion
            ? question.suggestion
            : (drafts[question.name] ?? question.current)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (disabled) return
        setSubmitting(true)
        try {
            await onSubmit(
                Object.fromEntries(questions.map(question => [question.name, answerFor(question)])),
            )
            setDrafts({})
            setSelected({})
            setEditTicks({})
        } catch {
            // The parent reports transport errors and the questionnaire remains editable.
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Questionnaire.Root
            className="case-questionnaire"
            items={items}
            shortcuts="letters"
            onSubmit={event => void submit(event)}
        >
            <Questionnaire.Progress
                render={(props, state) => (
                    <div
                        {...props}
                        className="questionnaire-progress"
                        aria-label="Questionnaire progress"
                        style={
                            {
                                "--progress": state.total ? state.current / state.total : 0,
                            } as CSSProperties
                        }
                    >
                        <span>
                            Question {state.current} of {state.total}
                        </span>
                        <i />
                    </div>
                )}
            />
            {questions.map(question => (
                <Questionnaire.Item
                    key={question.name}
                    name={question.name}
                    disabled={disabled}
                    required
                >
                    <Questionnaire.Title>{question.prompt}</Questionnaire.Title>
                    <Questionnaire.Description>{question.description}</Questionnaire.Description>
                    <Questionnaire.Choices>
                        {question.suggestion && (
                            <Questionnaire.Choice
                                className="suggested-answer"
                                value={question.suggestion}
                                disabled={disabled}
                                checked={selected[question.name] ?? false}
                                onChange={() => {
                                    // Keep any custom draft: `answerFor` prefers the
                                    // suggestion while it is selected, and typing again
                                    // deselects it, so nothing the user wrote is lost.
                                    setSelected(value => ({ ...value, [question.name]: true }))
                                }}
                            >
                                <Questionnaire.ChoiceInput />
                                <span className="suggestion-icon">
                                    <Lightbulb size={16} />
                                </span>
                                <Questionnaire.ChoiceLabel>
                                    <small>Suggested answer</small>
                                    <span>{question.suggestion}</span>
                                </Questionnaire.ChoiceLabel>
                                <Questionnaire.ChoiceShortcut />
                            </Questionnaire.Choice>
                        )}
                        {question.suggestion && (
                            <button
                                type="button"
                                className="suggestion-edit"
                                disabled={disabled}
                                onClick={() => {
                                    setSelected(value => ({ ...value, [question.name]: false }))
                                    setDrafts(value => ({
                                        ...value,
                                        [question.name]: question.suggestion!,
                                    }))
                                    setEditTicks(value => ({
                                        ...value,
                                        [question.name]: (value[question.name] ?? 0) + 1,
                                    }))
                                }}
                            >
                                <PencilLine size={12} aria-hidden="true" />
                                Edit this suggested answer
                            </button>
                        )}
                        <AnswerField
                            label={question.suggestion ? "Or write your own answer" : "Your answer"}
                            value={drafts[question.name] ?? question.current}
                            disabled={disabled}
                            focusTick={editTicks[question.name] ?? 0}
                            onChange={value => {
                                setSelected(current => ({ ...current, [question.name]: false }))
                                setDrafts(current => ({ ...current, [question.name]: value }))
                            }}
                        />
                        {question.suggestion &&
                            selected[question.name] &&
                            (drafts[question.name] ?? question.current).trim() !== "" && (
                                <p className="questionnaire-note">
                                    Your own answer is kept below. The suggested answer will be sent
                                    unless you type in it again.
                                </p>
                            )}
                    </Questionnaire.Choices>
                    <Questionnaire.Error>Please provide an answer to continue.</Questionnaire.Error>
                </Questionnaire.Item>
            ))}
            <div className="questionnaire-actions">
                <Questionnaire.Previous className="questionnaire-secondary" disabled={disabled}>
                    <ArrowLeft size={15} /> Previous
                </Questionnaire.Previous>
                <Questionnaire.Next className="questionnaire-primary" disabled={disabled}>
                    Next <ArrowRight size={15} />
                </Questionnaire.Next>
                <Questionnaire.Submit className="questionnaire-primary" disabled={disabled}>
                    {disabled ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                    {submitting ? "Saving…" : submitLabel}
                </Questionnaire.Submit>
            </div>
        </Questionnaire.Root>
    )
}

export function GrillQuestionnaire({
    questions,
    busy,
    onSubmit,
}: {
    questions: BackendQuestion[]
    busy: boolean
    onSubmit: (answers: Record<string, string>) => Promise<void>
}) {
    const single = questions.length === 1
    // A background case refresh hands back an equal but new array on every poll.
    // Mapping is keyed on the questions' own content so an unchanged open set keeps
    // the same mapped identity and the flow does not fall back to question one.
    const signature = questions
        .map(question =>
            [
                question.id,
                question.question,
                question.reason,
                question.suggestedAnswer ?? "",
                question.answer ?? "",
            ].join("\u001f"),
        )
        .join("\u001e")
    const mapped = useMemo(
        () =>
            questions.map(question => ({
                name: question.id,
                prompt: question.question,
                description: question.reason,
                suggestion: question.suggestedAnswer,
                current: question.answer ?? "",
            })),
        // `signature` stands in for `questions`: equal content keeps one identity.
        [signature],
    )
    return (
        <div className="grill-card">
            <div className="grill-heading">
                <div>
                    <span>CLAIMGUIDE</span>
                    <h2>{single ? "A question about your claim" : "Questions about your claim"}</h2>
                </div>
                <span>
                    {questions.length} {single ? "question" : "questions"} to review
                </span>
            </div>
            <QuestionFlow
                questions={mapped}
                submitLabel={single ? "Use this answer" : "Use these answers"}
                busy={busy}
                onSubmit={onSubmit}
            />
        </div>
    )
}

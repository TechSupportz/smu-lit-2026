import { useMemo, useState, type FormEvent } from "react"
import { Questionnaire } from "@shadcn/react/questionnaire"
import { ArrowLeft, ArrowRight, Check, Lightbulb, LoaderCircle } from "lucide-react"
import type { BackendQuestion } from "@/lib/backend"

type Question = {
    name: string
    prompt: string
    description: string
    suggestion: string | null
    current: string
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
    const [key, setKey] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const disabled = busy || submitting
    const items = useMemo(
        () =>
            questions.map(question => ({
                name: question.name,
                required: true,
                choices: question.suggestion ? [{ value: question.suggestion }] : [],
            })),
        [questions],
    )

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setSubmitting(true)
        try {
            await onSubmit(
                Object.fromEntries(
                    questions.map(question => [
                        question.name,
                        String(data.get(question.name) ?? ""),
                    ]),
                ),
            )
            setKey(value => value + 1)
        } catch {
            // The parent reports transport errors and the questionnaire remains editable.
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Questionnaire.Root
            key={key}
            className="case-questionnaire"
            items={items}
            shortcuts="letters"
            onSubmit={event => void submit(event)}
        >
            <Questionnaire.Progress
                render={(props, state) => (
                    <div {...props} className="questionnaire-progress" aria-label="Questionnaire progress">
                        <span>
                            Question {state.current} of {state.total}
                        </span>
                        <i style={{ width: `${(state.current / state.total) * 100}%` }} />
                    </div>
                )}
            />
            {questions.map(question => (
                <Questionnaire.Item key={question.name} name={question.name} required>
                    <Questionnaire.Title>{question.prompt}</Questionnaire.Title>
                    <Questionnaire.Description>{question.description}</Questionnaire.Description>
                    <Questionnaire.Choices>
                        {question.suggestion && (
                            <Questionnaire.Choice
                                className="suggested-answer"
                                value={question.suggestion}
                                checked={selected[question.name] ?? false}
                                onChange={() => {
                                    setSelected(value => ({ ...value, [question.name]: true }))
                                    setDrafts(value => ({ ...value, [question.name]: "" }))
                                }}
                            >
                                <Questionnaire.ChoiceInput />
                                <span className="suggestion-icon"><Lightbulb size={16} /></span>
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
                                className="text-xs underline mt-2 text-muted-foreground"
                                disabled={disabled}
                                onClick={() => {
                                    setSelected(value => ({ ...value, [question.name]: false }))
                                    setDrafts(value => ({ ...value, [question.name]: question.suggestion! }))
                                }}
                            >
                                Edit suggested answer
                            </button>
                        )}
                        <label className="questionnaire-freeform">
                            <span>{question.suggestion ? "Or write your own answer" : "Your answer"}</span>
                            <Questionnaire.Input
                                aria-label={`Answer: ${question.prompt}`}
                                value={drafts[question.name] ?? question.current}
                                onChange={event => {
                                    setSelected(value => ({ ...value, [question.name]: false }))
                                    setDrafts(value => ({ ...value, [question.name]: event.target.value }))
                                }}
                                placeholder="Type your answer…"
                            />
                        </label>
                    </Questionnaire.Choices>
                    <Questionnaire.Error>Please provide an answer to continue.</Questionnaire.Error>
                </Questionnaire.Item>
            ))}
            <div className="questionnaire-actions">
                <Questionnaire.Previous className="questionnaire-secondary">
                    <ArrowLeft size={15} /> Previous
                </Questionnaire.Previous>
                <Questionnaire.Next className="questionnaire-primary">
                    Next <ArrowRight size={15} />
                </Questionnaire.Next>
                <Questionnaire.Submit className="questionnaire-primary" disabled={disabled}>
                    {disabled ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                    {submitLabel}
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
    return (
        <div className="grill-card">
            <div className="grill-heading">
                <div>
                    <span>CLAIMGUIDE</span>
                    <h2>A question about your claim</h2>
                </div>
                <span>{questions.length} to review</span>
            </div>
            <QuestionFlow
                questions={questions.map(question => ({
                    name: question.id,
                    prompt: question.question,
                    description: question.reason,
                    suggestion: question.suggestedAnswer,
                    current: question.answer ?? "",
                }))}
                submitLabel="Use these answers"
                busy={busy}
                onSubmit={onSubmit}
            />
        </div>
    )
}

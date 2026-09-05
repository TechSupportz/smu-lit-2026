import type { CaseState, CaseStore, EvidenceExtractionRecord } from "../storage/case-store.js"

interface AmountCandidate {
    cents: number
    display: string
}

function amountFromText(value: string): AmountCandidate | null {
    const match = /(?:S\$|SGD|\$)\s*([0-9][0-9,]*)(?:\.([0-9]{1,2}))?/i.exec(value)
    if (!match?.[1]) return null
    const dollars = Number.parseInt(match[1].replaceAll(",", ""), 10)
    const cents = Number.parseInt((match[2] ?? "").padEnd(2, "0") || "0", 10)
    if (!Number.isSafeInteger(dollars) || dollars < 0) return null
    return { cents: dollars * 100 + cents, display: `SGD ${(dollars + cents / 100).toFixed(2)}` }
}

function factAmount(fact: CaseState["facts"][number]): AmountCandidate | null {
    const structured = fact.structuredValue?.amountCents
    if (typeof structured === "number" && Number.isSafeInteger(structured) && structured >= 0) {
        return { cents: structured, display: `SGD ${(structured / 100).toFixed(2)}` }
    }
    return amountFromText(fact.statement)
}

function citedExtraction(state: CaseState, item: EvidenceExtractionRecord): string {
    const evidence = state.evidence.find(candidate => candidate.id === item.evidenceId)
    const location =
        item.page !== null ? `page ${item.page}` : (item.location ?? "location not recorded")
    return `${evidence?.originalFilename ?? item.evidenceId}, ${location}`
}

function normalizedName(value: string): string {
    return value
        .toLowerCase()
        .replace(/\b(pte|private|ltd|limited|llp|company|co)\b/g, "")
        .replace(/[^a-z0-9]/g, "")
}

/**
 * Adds deterministic discrepancy records for high-signal conflicts. It never
 * decides which account is correct, changes fact review, or treats a mismatch
 * as an eligibility failure.
 */
export function reconcileCase(store: CaseStore, caseId: string): void {
    let state = store.getCaseState(caseId)
    const existingDescriptions = new Set(state.contradictions.map(item => item.description))
    const existingQuestions = new Set(state.questions.map(item => item.question))

    const documentAmounts = state.extractions
        .filter(item => item.type === "AMOUNT")
        .flatMap(item => {
            const amount =
                amountFromText(item.value) ?? (item.quote ? amountFromText(item.quote) : null)
            return amount ? [{ item, amount }] : []
        })

    for (const fact of state.facts.filter(
        item => item.sourceType === "USER_ASSERTION" && item.reviewStatus !== "REJECTED",
    )) {
        const asserted = factAmount(fact)
        if (
            !asserted ||
            !/\b(amount|cost|deposit|paid|payment|price|quote|refund|rent|claim)\b/i.test(
                fact.statement,
            )
        )
            continue
        for (const document of documentAmounts) {
            if (asserted.cents === document.amount.cents) continue
            const citation = citedExtraction(state, document.item)
            const description = `The user assertion records ${asserted.display}, while ${citation} records ${document.amount.display}. Neither amount was selected as correct.`
            if (!existingDescriptions.has(description)) {
                store.addContradiction(caseId, {
                    expectedRevision: state.case.revision,
                    description,
                    factIds: [fact.id],
                    evidenceIds: [document.item.evidenceId],
                    severity: "HIGH",
                })
                existingDescriptions.add(description)
                state = store.getCaseState(caseId)
            }
            const question = `Which amount is correct—${asserted.display} from your account or ${document.amount.display} in ${citation}—and what explains the difference?`
            if (!existingQuestions.has(question)) {
                store.addQuestion(caseId, {
                    expectedRevision: state.case.revision,
                    question,
                    reason: "A material user/document amount discrepancy must be resolved or explicitly carried as uncertainty.",
                    relatedFactIds: [fact.id],
                    priority: "REQUIRED",
                })
                existingQuestions.add(question)
                state = store.getCaseState(caseId)
            }
        }
    }

    const estimatedDates = state.extractions.filter(
        item =>
            (item.type === "DATE" || item.type === "CONTRACT_TERM") &&
            /\b(estimate|estimated|approximately|around|target|indicative)\b/i.test(
                `${item.value} ${item.quote ?? ""}`,
            ),
    )
    for (const fact of state.facts.filter(
        item =>
            item.sourceType === "USER_ASSERTION" &&
            item.reviewStatus !== "REJECTED" &&
            /\b(promised|guaranteed|firm|deadline|must|would be completed|would deliver)\b/i.test(
                item.statement,
            ),
    )) {
        for (const extraction of estimatedDates) {
            const citation = citedExtraction(state, extraction)
            const description = `The user account describes a firm commitment, while ${citation} uses estimated or non-firm wording: "${extraction.quote ?? extraction.value}".`
            if (!existingDescriptions.has(description)) {
                store.addContradiction(caseId, {
                    expectedRevision: state.case.revision,
                    description,
                    factIds: [fact.id],
                    evidenceIds: [extraction.evidenceId],
                    severity: "MEDIUM",
                })
                existingDescriptions.add(description)
                state = store.getCaseState(caseId)
            }
            const question = `Was the date in ${citation} expressly made firm later, or should it remain recorded as estimated?`
            if (!existingQuestions.has(question)) {
                store.addQuestion(caseId, {
                    expectedRevision: state.case.revision,
                    question,
                    reason: "Estimated wording must not be silently converted into a firm promise.",
                    relatedFactIds: [fact.id],
                    priority: "REQUIRED",
                })
                existingQuestions.add(question)
                state = store.getCaseState(caseId)
            }
        }
    }

    const partyExtractions = state.extractions.filter(item => item.type === "PARTY")
    for (const respondent of state.parties.filter(
        item => item.role === "RESPONDENT" && item.kind === "ENTITY" && item.name,
    )) {
        const expectedName = normalizedName(respondent.name!)
        if (
            partyExtractions.length === 0 ||
            partyExtractions.some(item => {
                const candidate = normalizedName(item.value)
                return (
                    candidate === expectedName ||
                    candidate.includes(expectedName) ||
                    expectedName.includes(candidate)
                )
            })
        )
            continue
        const citations = partyExtractions.map(
            item => `${item.value} (${citedExtraction(state, item)})`,
        )
        const evidenceIds = [...new Set(partyExtractions.map(item => item.evidenceId))]
        const description = `The recorded respondent is "${respondent.name}", but extracted document party names are ${citations.join("; ")}. The legal entity identity has not been reconciled.`
        if (!existingDescriptions.has(description)) {
            store.addContradiction(caseId, {
                expectedRevision: state.case.revision,
                description,
                factIds: [],
                evidenceIds,
                severity: "HIGH",
            })
            existingDescriptions.add(description)
            state = store.getCaseState(caseId)
        }
        const question = `Is the correct respondent "${respondent.name}", or one of the differently named entities in the uploaded evidence? Please verify the legal name and explain any trading-name relationship.`
        if (!existingQuestions.has(question)) {
            store.addQuestion(caseId, {
                expectedRevision: state.case.revision,
                question,
                reason: "A company-name mismatch can affect party identification and service; the harness must not choose an entity automatically.",
                relatedFactIds: [],
                priority: "REQUIRED",
            })
        }
    }
}

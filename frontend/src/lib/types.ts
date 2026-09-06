export type Stage = "landing" | "eligibility" | "filing" | "checkpoint" | "preparation" | "complete"
export type CheckStatus = "pending" | "checking" | "passed" | "blocked"
export type EligibilityAnswers = {
    amount: string
    eventDate: string
    respondentInSingapore: string
    category: string
    consent: boolean
}
export type EligibilityCheck = { id: string; label: string; status: CheckStatus; detail?: string }
export type CaseDetails = { respondent: string; summary: string; outcome: string }
export type CasePrepArtifact = {
    filename: string
    sha256: string
    pageCount: number
    url: string
}
export type CasePrepBundle = {
    cueCard: CasePrepArtifact
    stack: CasePrepArtifact
    prefiling: { filename: string; url: string } | null
    evidence: Array<{ id: string; originalFilename: string; url: string }>
}
export type CaseFile = {
    id: string
    name: string
    size: number
    kind: "evidence" | "generated"
    status: "generating" | "ready" | "failed"
    backendStored?: boolean
    backendSource?: {
        caseId: string
        type: "evidence" | "snapshot"
        recordId: string
    }
    error?: string
}
export type ChatStage = "filing" | "preparation"
export const categories = [
    { value: "goods", label: "A purchase gone wrong" },
    { value: "services", label: "A service not delivered" },
    {
        value: "tenancy",
        label: "A rental deposit",
        detail: "Residential tenancy of no more than 2 years",
    },
    { value: "property", label: "Damage to my property" },
    { value: "unfair", label: "An unfair sales practice" },
    { value: "vehicle", label: "Motor vehicle property damage" },
    { value: "neighbour", label: "Property damage caused by a neighbour" },
    { value: "employment", label: "An employment matter" },
    { value: "other", label: "Something else / I’m not sure" },
]
export const initialChecks: EligibilityCheck[] = [
    { id: "value", label: "Claim amount", status: "pending" },
    { id: "time", label: "Within the time limit", status: "pending" },
    { id: "location", label: "Respondent in Singapore", status: "pending" },
    { id: "category", label: "Type of dispute", status: "pending" },
]
export const checklistItems = [
    {
        id: "filed",
        title: "File your claim and pay the filing fee",
        description:
            "Use CJTS to complete the official pre-filing assessment, submit your claim and supporting documents, and make payment.",
        link: "https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim",
        linkLabel: "Filing and payment guide",
    },
    {
        id: "served",
        title: "Serve the respondent",
        description:
            "Follow the court’s instructions to deliver the claim and Notice of Consultation to the respondent. Keep your proof of service.",
        link: "https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim",
        linkLabel: "How to serve your claim",
    },
    {
        id: "declaration",
        title: "File your Declaration of Service",
        description:
            "Record how and when the documents were served in CJTS, and attach your proof before the first consultation.",
        link: "https://www.judiciary.gov.sg/civil/before-going-to-court-small-claim",
        linkLabel: "Before your consultation",
    },
]

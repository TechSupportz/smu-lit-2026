#set document(title: "SCT Pre-Filing Case Summary", author: "SCT Pre-Filing Agent Harness")
#set page(
  paper: "a4",
  margin: (top: 19mm, bottom: 18mm, left: 18mm, right: 18mm),
  header: context {
    if counter(page).get().first() > 1 {
      set text(font: "Arial", size: 7.5pt, tracking: 0.6pt, fill: rgb("4b5563"))
      grid(columns: (1fr, auto), [SCT PRE-FILING SUMMARY], [REVIEWED CASE SNAPSHOT])
      v(2pt)
      line(length: 100%, stroke: 0.5pt + rgb("9ca3af"))
    }
  },
  footer: context {
    set text(font: "Arial", size: 7pt, fill: rgb("6b7280"))
    line(length: 100%, stroke: 0.45pt + rgb("d1d5db"))
    v(2.5pt)
    grid(
      columns: (1fr, auto, 1fr),
      align: (left, center, right),
      [PREPARATION SUMMARY],
      [NOT AN OFFICIAL COURT FORM],
      [PAGE #counter(page).display("1")],
    )
  },
)

#set text(font: "Libertinus Serif", size: 9.4pt, fill: rgb("111827"), lang: "en")
#set par(justify: false, leading: 0.62em)
#set heading(numbering: none)
#show heading.where(level: 1): it => {
  v(8pt)
  text(font: "Arial", size: 13pt, weight: "bold", fill: rgb("111827"), upper(it.body))
  v(2pt)
  line(length: 100%, stroke: 0.9pt + rgb("111827"))
  v(5pt)
}
#show heading.where(level: 2): it => {
  v(6pt)
  text(font: "Arial", size: 9.5pt, weight: "bold", fill: rgb("374151"), it.body)
  v(2pt)
}

#let data = json(sys.inputs.at("snapshot"))
#let snap = data.at("snapshot")
#let status = data.at("status")
#let dispute = data.at("dispute")
#let claim = data.at("claimsAndRemedies")

#let value(dict, key, fallback: "Not recorded") = {
  let found = dict.at(key, default: none)
  if found == none or found == "" { fallback } else { str(found) }
}

#let money(cents) = {
  if cents == none { "Not recorded" }
  else {
    let fractional = calc.rem(cents, 100)
    "SGD " + str(calc.floor(cents / 100)) + "." + if fractional < 10 { "0" } else { "" } + str(fractional)
  }
}

#let label(content) = text(font: "Arial", size: 7.2pt, weight: "bold", fill: rgb("6b7280"), upper(content))
#let badge(content, tone: "neutral") = {
  let colors = if tone == "danger" { (rgb("7f1d1d"), rgb("fee2e2")) }
    else if tone == "warning" { (rgb("78350f"), rgb("fef3c7")) }
    else if tone == "success" { (rgb("14532d"), rgb("dcfce7")) }
    else { (rgb("374151"), rgb("f3f4f6")) }
  box(inset: (x: 5pt, y: 2.5pt), radius: 2pt, fill: colors.at(1), stroke: 0.4pt + colors.at(0))[
    #text(font: "Arial", size: 7pt, weight: "bold", fill: colors.at(0), upper(str(content)))
  ]
}
#let notice(title, body, tone: "neutral") = {
  let colors = if tone == "danger" { (rgb("991b1b"), rgb("fef2f2")) }
    else if tone == "warning" { (rgb("92400e"), rgb("fffbeb")) }
    else { (rgb("374151"), rgb("f9fafb")) }
  block(width: 100%, inset: 8pt, fill: colors.at(1), stroke: (left: 2.4pt + colors.at(0), rest: 0.45pt + colors.at(0)))[
    #text(font: "Arial", size: 8pt, weight: "bold", fill: colors.at(0), upper(title))
    #v(3pt)
    #body
  ]
}
#let pair(label-text, body) = block(below: 5pt)[
  #label(label-text)
  #v(1.5pt)
  #body
]
#let empty-row(content) = table.cell(colspan: 2, inset: 6pt)[#text(fill: rgb("6b7280"), style: "italic", content)]

#align(center)[
  #v(8mm)
  #line(length: 100%, stroke: 1.2pt + rgb("111827"))
  #v(6mm)
  #text(font: "Arial", size: 9pt, tracking: 1.2pt, weight: "bold")[SMALL CLAIMS TRIBUNALS]
  #v(5mm)
  #text(font: "Libertinus Serif", size: 22pt, weight: "bold")[PRE-FILING CASE SUMMARY]
  #v(3mm)
  #text(font: "Arial", size: 10pt, fill: rgb("4b5563"))[REVIEWED SNAPSHOT - ORIGINAL EVIDENCE STORED SEPARATELY]
]

#v(9mm)
#notice("Preparation record - not for filing", [
  This document organises case information for review. It is not an official court form, legal advice, a finding that allegations are true, a prediction of success, or confirmation that CJTS accepted a claim.
], tone: "warning")

#v(7mm)
#grid(
  columns: (1fr, 1fr),
  gutter: 9pt,
  [
    #pair("CASE", value(snap, "displayName"))
    #pair("SNAPSHOT ID", value(snap, "id"))
  ],
  [
    #pair("CREATED", value(snap, "createdAt"))
    #pair("CASE REVISION", value(snap, "caseRevision"))
  ],
)

#v(3mm)
#let eligibility = value(status, "eligibilityStatus")
#let handoff = value(status, "handoffPermission")
#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 6pt,
  [#label("ELIGIBILITY") #v(2pt) #badge(eligibility, tone: if eligibility == "FAIL" { "danger" } else if eligibility == "UNVERIFIED" { "warning" } else { "success" })],
  [#label("PREPARATION") #v(2pt) #badge(value(status, "preparationStatus"), tone: if value(status, "preparationStatus") == "READY" { "success" } else { "warning" })],
  [#label("HANDOFF") #v(2pt) #badge(handoff, tone: if handoff == "BLOCKED_ELIGIBILITY" { "danger" } else if handoff == "FILING_READY" { "success" } else { "warning" })],
)

#if eligibility == "FAIL" [
  #v(7pt)
  #notice("Filing-ready handoff blocked", [At least one verified eligibility check failed. The saved case remains editable, but this snapshot must not be presented as filing-ready.], tone: "danger")
] else if eligibility == "UNVERIFIED" [
  #v(7pt)
  #notice("Eligibility not fully verified", [Unknown or unavailable inputs prevented a complete eligibility check. Export is permitted with this disclosure; unverified does not mean passed or failed.], tone: "warning")
]

= Unresolved warnings

#let warnings = data.at("warnings", default: ())
#if warnings.len() == 0 [
  #notice("No active warnings", [No unresolved warnings were saved in this snapshot.], tone: "neutral")
] else {
  for warning in warnings {
    let acknowledged = value(warning, "status") == "ACKNOWLEDGED"
    notice(
      value(warning, "code") + if acknowledged { " - acknowledged" } else { " - unresolved" },
      [#value(warning, "message")],
      tone: if acknowledged { "warning" } else { "danger" },
    )
    v(5pt)
  }
}

= Parties

#let parties = data.at("parties", default: ())
#if parties.len() == 0 [#empty-row("No parties recorded.")] else {
  table(
    columns: (0.8fr, 0.8fr, 1.35fr, 2fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*ROLE*], [*TYPE*], [*NAME*], [*ADDRESS / CONTACT*]),
    ..parties.map(party => (
      [#value(party, "role")],
      [#value(party, "kind")],
      [#value(party, "name")],
      [#value(party, "address") #linebreak() #value(party, "email", fallback: "")],
    )).flatten(),
  )
}

= Claim and remedy

#grid(
  columns: (1fr, 1fr), gutter: 9pt,
  [#pair("DISPUTE CATEGORY", value(dispute, "category")) #pair("SUBTYPE", value(dispute, "subtype"))],
  [#pair("CLAIM AMOUNT", money(claim.at("claimAmountCents", default: none))) #pair("MEMORANDUM OF CONSENT", value(claim, "consentStatus"))],
)
#pair("CAUSE-OF-ACTION DATE", value(dispute, "causeOfActionDate") + " (" + value(dispute, "causeOfActionDatePrecision") + ")")
#pair("ORIGINAL DATE WORDING", value(dispute, "causeOfActionDateOriginal"))
#pair("FACTUAL SUMMARY", value(dispute, "factualSummary"))

== Requested remedies

#let remedies = claim.at("remedies", default: ())
#if remedies.len() == 0 [#empty-row("No remedy recorded.")] else {
  table(
    columns: (0.8fr, 2.5fr, 1fr, 1.6fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*TYPE*], [*DESCRIPTION*], [*AMOUNT*], [*BASIS*]),
    ..remedies.map(remedy => (
      [#value(remedy, "type")], [#value(remedy, "description")],
      [#money(remedy.at("amountCents", default: none))], [#value(remedy, "basis")],
    )).flatten(),
  )
}

= Material facts

#let facts = data.at("facts", default: ())
#if facts.len() == 0 [#empty-row("No facts recorded.")] else {
  table(
    columns: (2.6fr, 0.85fr, 0.85fr, 0.95fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*STATEMENT*], [*ORIGIN*], [*USER REVIEW*], [*EVIDENCE*]),
    ..facts.map(fact => (
      [#value(fact, "statement")], [#value(fact, "sourceType")],
      [#value(fact, "reviewStatus")], [#value(fact, "evidenceAssessment")],
    )).flatten(),
  )
}

= Timeline

#let timeline = data.at("timeline", default: ())
#if timeline.len() == 0 [#empty-row("No date-bearing facts were recorded.")] else {
  table(
    columns: (1fr, 2.8fr, 1fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*DATE / WORDING*], [*EVENT*], [*STATUS*]),
    ..timeline.map(event => (
      [#value(event, "date", fallback: value(event, "originalWording"))],
      [#value(event, "statement")],
      [#value(event, "reviewStatus") / #value(event, "evidenceAssessment")],
    )).flatten(),
  )
}

= Evidence index

#let evidence = data.at("evidenceIndex", default: ())
#if evidence.len() == 0 [#empty-row("No evidence uploaded.")] else {
  table(
    columns: (1.5fr, 0.8fr, 1.2fr, 2fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*ORIGINAL FILE*], [*STATUS*], [*RELEVANT PAGES*], [*DESCRIPTION / HASH*]),
    ..evidence.map(item => (
      [#value(item, "originalFilename")],
      [#value(item, "processingStatus")],
      [#item.at("relevantPages", default: ()).map(page => str(page)).join(", ")],
      [#value(item, "description") #linebreak() #text(size: 6.8pt, fill: rgb("6b7280"))[SHA-256: #value(item, "sha256")]],
    )).flatten(),
  )
}

== Evidence citations

#for item in evidence {
  let extractions = item.at("extractions", default: ())
  if extractions.len() > 0 {
    heading(level: 2)[#value(item, "originalFilename")]
    list(
      ..extractions.map(extraction => [
        #value(extraction, "type"): #value(extraction, "value")
        #if extraction.at("page", default: none) != none [ (page #value(extraction, "page"))]
        #if extraction.at("location", default: none) != none [ - #value(extraction, "location")]
        #if extraction.at("quote", default: none) != none [ - "#value(extraction, "quote")"]
      ]),
    )
  }
}

= Questions and contradictions

== Unresolved questions
#let questions = data.at("unresolvedQuestions", default: ())
#if questions.len() == 0 [No unresolved questions were saved.] else {
  list(..questions.map(question => [*#value(question, "priority")* - #value(question, "question") (#value(question, "status"))]))
}

== Contradictions
#let contradictions = data.at("contradictions", default: ())
#if contradictions.len() == 0 [No unresolved contradictions were saved.] else {
  list(..contradictions.map(conflict => [*#value(conflict, "severity")* - #value(conflict, "description") (#value(conflict, "status"))]))
}

= Procedural checks

#let checks = data.at("proceduralChecks", default: ())
#if checks.len() == 0 [#empty-row("No procedural checks recorded.")] else {
  table(
    columns: (1fr, 0.75fr, 2.6fr, 1.1fr),
    inset: 5pt,
    stroke: 0.45pt + rgb("d1d5db"),
    table.header([*CHECK*], [*RESULT*], [*EXPLANATION*], [*RETRIEVAL*]),
    ..checks.map(item => (
      [#value(item, "code")], [#value(item, "result")],
      [#value(item, "explanation") #linebreak() #text(size: 6.8pt, fill: rgb("6b7280"))[#value(item, "sourceUrl")]],
      [#value(item, "retrievalStatus")],
    )).flatten(),
  )
}

= Review record and limitations

#let review = data.at("reviewRecords")
#pair("CASE REVIEWED BY USER", value(review, "caseUserReviewed"))
#pair("SUPERSEDES SNAPSHOT", value(snap, "supersedesSnapshotId", fallback: "None - first snapshot"))

#notice("Important limits", [
  #list(..data.at("limitations", default: ()).map(item => [#item]))
], tone: "warning")

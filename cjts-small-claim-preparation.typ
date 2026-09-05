#set document(title: "CJTS Small-Claim Preparation Worksheet", author: "Source-derived working aid")
#set page(
  paper: "a4",
  margin: (top: 21mm, bottom: 19mm, left: 18mm, right: 18mm),
  header: context {
    if counter(page).get().first() > 1 {
      set text(font: "Arial", size: 7.5pt, tracking: 0.7pt, fill: rgb("444444"))
      grid(
        columns: (1fr, auto),
        align: (left, right),
        [SMALL CLAIMS TRIBUNALS],
        [CJTS CLAIM PREPARATION],
      )
      v(2.5pt)
      line(length: 100%, stroke: 0.55pt)
    }
  },
  footer: context {
    set text(font: "Arial", size: 7pt, fill: rgb("555555"))
    line(length: 100%, stroke: 0.45pt)
    v(3pt)
    grid(
      columns: (1fr, auto, 1fr),
      align: (left, center, right),
      [SOURCE: APRIL 2022 CJTS GUIDE],
      [PREPARATION AID - NOT A COURT FORM],
      [PAGE #counter(page).display("1")],
    )
  },
)

#set text(font: "Libertinus Serif", size: 9.5pt, lang: "en")
#set par(justify: true, leading: 0.58em)
#set list(indent: 14pt, body-indent: 5pt, spacing: 2.5pt)
#set enum(indent: 16pt, body-indent: 5pt, spacing: 3pt)
#set heading(numbering: "1.")
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(2pt)
  text(font: "Arial", size: 13pt, weight: "bold", tracking: 0.25pt, upper(it.body))
  v(2pt)
  line(length: 100%, stroke: 1pt)
  v(7pt)
}
#show heading.where(level: 2): it => {
  v(6pt)
  text(font: "Arial", size: 10pt, weight: "bold", tracking: 0.15pt, it.body)
  v(2pt)
}

#let ink = rgb("161616")
#let mid = rgb("666666")
#let pale = rgb("f5f4f1")
#let rule = 0.65pt + ink

#let tick(body) = block(above: 1.8pt, below: 1.8pt, breakable: false)[
  #box(width: 9pt, height: 9pt, stroke: 0.7pt + ink)
  #h(5pt)
  #body
]

#let field(label, height: 10mm, note: none) = block(above: 3pt, below: 4pt, breakable: false)[
  #text(font: "Arial", size: 7.7pt, weight: "bold", fill: ink)[#label]
  #if note != none { h(4pt); text(font: "Arial", size: 6.8pt, style: "italic", fill: mid)[#note] }
  #v(2pt)
  #rect(width: 100%, height: height, stroke: 0.55pt + ink, inset: 3pt)
]

#let pair(left, right, ratio: (1fr, 1fr)) = grid(
  columns: ratio,
  gutter: 7pt,
  left,
  right,
)

#let notice(title, body, strong: false) = block(
  width: 100%,
  inset: 8pt,
  stroke: (left: 2.2pt + ink, rest: 0.55pt + ink),
  fill: if strong { rgb("eeeeeb") } else { pale },
  breakable: false,
)[
  #text(font: "Arial", size: 8pt, weight: "bold", tracking: 0.3pt, upper(title))
  #v(3pt)
  #body
]

#let choice(label) = box[
  #box(width: 8pt, height: 8pt, stroke: 0.65pt + ink)
  #h(3pt)
  #label
]

#align(center)[
  #v(8mm)
  #line(length: 100%, stroke: 1.25pt)
  #v(7mm)
  #text(font: "Arial", size: 10pt, tracking: 1.3pt, weight: "bold")[STATE COURTS - SMALL CLAIMS TRIBUNALS]
  #v(10mm)
  #text(font: "Libertinus Serif", size: 23pt, weight: "bold", tracking: 0.3pt)[CJTS CLAIM PREPARATION]
  #v(2mm)
  #text(font: "Arial", size: 15pt, weight: "bold", tracking: 0.8pt)[WORKSHEET]
  #v(7mm)
  #line(length: 58%, stroke: 0.8pt)
  #v(8mm)
  #text(size: 11pt, style: "italic")[For an individual claimant preparing to file online]
]

#v(14mm)
#notice("Preparation copy - not for filing", strong: true)[
  This worksheet helps a claimant collect information before entering it into CJTS. It is not an official claim form, does not replace the live form, and is not legal advice. The source guide was created in April 2022; check the current CJTS service for changed fields, limits, fees, or directions.
]

#v(10mm)
#pair(
  field("CLAIMANT'S FULL NAME", height: 12mm),
  field("DATE PREPARED", height: 12mm),
)
#pair(
  field("PRE-FILING REFERENCE ID", height: 12mm, note: "valid for 7 days under the source guide"),
  field("DRAFT / CLAIM NUMBER", height: 12mm, note: "complete when issued"),
)

#v(6mm)
#align(center)[
  #text(font: "Arial", size: 8pt, weight: "bold", tracking: 0.7pt)[READ THIS FIRST]
]
#v(2mm)
#grid(
  columns: (1fr, 1fr),
  gutter: 9pt,
  [
    #tick[Use one main dispute category per claim.]
    #tick[Set aside about 15 minutes.]
    #tick[Prepare respondent details before starting.]
  ],
  [
    #tick[Prepare PDF evidence, each no larger than 5 MB.]
    #tick[Check every entry before payment.]
    #tick[Save all acknowledgements and copies.]
  ],
)

#pagebreak()
= Filing map

#notice("The filing sequence")[
*01 - Assess*  Choose the dispute type, enter the cause-of-action date and amount, and answer the conditional eligibility questions.

*02 - Record the ID*  Save the Pre-filing Reference ID. The source guide says it is required and expires after seven days.

*03 - Prepare*  Gather claimant and respondent particulars, the short claim summary, the requested remedy, and supporting PDFs.

*04 - Enter and review*  Retrieve the assessment in the Claim Form, complete all six sections, correct errors, and make the declaration.

*05 - Pay and schedule*  Pay the fee, state any language need, and choose the consultation date and time.

*06 - Save and serve*  Save the receipt and claimant/respondent copies, then serve the correct copy on each respondent.
]

== Source-guide time limits

#table(
  columns: (1.2fr, 0.8fr, 2.8fr),
  inset: 5pt,
  stroke: 0.5pt,
  align: (left, left, left),
  table.header(
    [*ITEM*], [*PERIOD*], [*WHAT THE APRIL 2022 GUIDE SAYS*],
  ),
  [Pre-filing ID], [7 days], [Use it to file the claim or repeat the assessment.],
  [Saved claim draft], [7 days], [A draft is not a filed claim. Note its draft number.],
  [Pay Later draft], [3 days], [Generate the Payment Advice and complete payment.],
)

== Important handling rules

#tick[Read the online Terms and Conditions, tick the agreement, and enter the CAPTCHA.]
#tick[Do not use the browser Back, Forward, or Refresh controls during submission.]
#tick[An individual filing personally logs in with Singpass; entities use Corppass; a person ineligible for Singpass may use CJTS Pass.]
#tick[A claim is treated as filed only after payment and issue of a claim number.]

#notice("Respondent visibility", strong: true)[
  The guide's claim-form instructions state that the respondent can see all details entered and documents uploaded, except the identification number. Review the narrative and attachments for unrelated sensitive information before submission.
]

#pagebreak()
= Pre-filing assessment

== Core inputs

#field("NATURE OF DISPUTE - SELECT ONE MAIN CATEGORY", height: 11mm)
#grid(
  columns: (1fr, 1fr),
  gutter: 6pt,
  [#tick[Contract for sale of goods] #tick[Damage to property]],
  [#tick[Contract for provision of services] #tick[Lease not exceeding 2 years - residential premises]],
)
#field("DISPUTE SUB-CATEGORY / TYPE", height: 11mm)
#pair(
  field("DATE OF CAUSE OF ACTION", height: 11mm, note: "DD/MM/YYYY"),
  field("CLAIM AMOUNT", height: 11mm, note: "SGD"),
)

#notice("One category per claim")[
The guide says that claims against the same party involving more than one main dispute category must be filed separately. CJTS checks the entered date and amount and may warn that a claim is time-barred or outside SCT monetary jurisdiction.
]

== Conditional questions to prepare for

The live sequence depends on the dispute and earlier answers. The rental-deposit example in the source asks about:

#grid(
  columns: (1fr, 1fr),
  gutter: 9pt,
  [
    *Parties and agreement*
    #tick[Individual or entity status]
    #tick[Bankruptcy status of each party]
    #tick[Correct contractual counterparty]
    #tick[Mediation or arbitration clause]
  ],
  [
    *Evidence and service*
    #tick[Itemised breakdown of the amount]
    #tick[Documents supporting the amount]
    #tick[Singapore address or presence]
    #tick[Ability to locate and serve the respondent]
  ],
)

#v(4pt)
#field("QUESTIONS / WARNINGS SHOWN BY CJTS", height: 25mm)
#field("PRE-FILING REFERENCE ID", height: 12mm, note: "save immediately; the guide says it is not shown on Home")

#pagebreak()
= Particulars of claimant

The source says CJTS retrieves these details from the applicant's profile. Confirm or amend them before submission.

#pair(field("FULL NAME *", height: 10mm), field("ID TYPE AND NUMBER *", height: 10mm))
#pair(field("CONTACT NO. 1 *", height: 10mm, note: "type, country code, number"), field("CONTACT NO. 2", height: 10mm))
#field("VALID EMAIL ADDRESS *", height: 10mm)

== Registered or service address

#pair(field("PREMISES TYPE *", height: 10mm), field("POSTAL CODE *", height: 10mm))
#pair(field("BLOCK / HOUSE *", height: 10mm), field("STREET NAME *", height: 10mm))
#pair(field("FLOOR - UNIT *", height: 10mm), field("BUILDING NAME", height: 10mm))
#field("COUNTRY *", height: 10mm)

== Additional parties or addresses

#pair(
  field("ADDITIONAL CLAIMANT - NAME / ID", height: 16mm),
  field("ADDITIONAL ADDRESS FOR SERVICE", height: 16mm),
)
#field("OTHER CLAIMANT / ADDRESS NOTES", height: 18mm)

#notice("Check before submission", strong: true)[
  The guide says Contact No. 1 and the email may be used by the Tribunals. It also says an additional claimant, respondent, or address cannot subsequently be removed after the claim is submitted.
]

#pagebreak()
= Particulars of respondent

Use the exact legal or registered name and an address at which service can be completed.

#pair(field("FULL / REGISTERED NAME *", height: 10mm), field("ID TYPE AND NUMBER", height: 10mm, note: "NRIC / FIN / UEN / passport, if known"))
#pair(field("CONTACT NO. 1", height: 10mm), field("CONTACT NO. 2", height: 10mm))
#field("EMAIL ADDRESS", height: 10mm)

== Registered or service address

#pair(field("PREMISES TYPE *", height: 10mm), field("POSTAL CODE *", height: 10mm))
#pair(field("BLOCK / HOUSE *", height: 10mm), field("STREET NAME *", height: 10mm))
#pair(field("FLOOR - UNIT", height: 10mm), field("BUILDING NAME", height: 10mm))
#field("COUNTRY *", height: 10mm)

== Additional respondents

#field("RESPONDENT 2 - NAME, ID, CONTACT AND SERVICE ADDRESS", height: 22mm)
#field("RESPONDENT 3 / ADDITIONAL SERVICE ADDRESS", height: 22mm)

#notice("Business entity document")[
If a claimant or respondent is not an individual, the guide requires the latest ACRA Business Profile for that party to be uploaded. Each respondent must later receive the correct Respondent Copy with that respondent's unique one-time reference number.
]

#pagebreak()
= Particulars and summary of claim

== Universal claim information

#pair(
  field("NATURE OF DISPUTE", height: 10mm, note: "retrieved from pre-filing"),
  field("TYPE OF DISPUTE", height: 10mm, note: "retrieved from pre-filing"),
)
#field("NAME / TYPE OF GOODS SOLD OR SERVICES PROVIDED *", height: 12mm)
#field("OTHER DISPUTE-SPECIFIC FACTS REQUESTED BY CJTS", height: 24mm)

== Brief summary - maximum 500 characters

#notice("Drafting order")[
State: *(1)* what was agreed; *(2)* what happened; *(3)* when it happened; *(4)* what remains unresolved; and *(5)* the remedy sought. Use facts that can be supported by the documents.
]
#field("DRAFT SUMMARY", height: 45mm, note: "maximum 500 characters in the source guide")

== Rental-deposit example only

The following fields appear in the supplied guide's worked residential-tenancy example. They are not universal.

#pair(field("LOCATION OF RENTAL PREMISES *", height: 9mm), field("DEPOSIT PAID *", height: 9mm, note: "SGD"))
#pair(field("MONTHLY RENT *", height: 9mm, note: "SGD"), field("DATE OF TENANCY AGREEMENT *", height: 9mm))
#pair(field("TENANCY START DATE *", height: 9mm), field("TENANCY EXPIRY DATE *", height: 9mm))

#pagebreak()
= Supporting documents

#notice("Upload constraints", strong: true)[
  PDF only. Maximum 5 MB per document. Avoid special characters in filenames. For every file, select the document type, enter a description and referenced page number, then upload it. The guide says a submitted document cannot be deleted or removed from CJTS.
]

== Evidence checklist

#grid(
  columns: (1fr, 1fr),
  gutter: 9pt,
  [
    #tick[Contract, quotation, or agreement]
    #tick[Invoice, receipt, or proof of payment]
    #tick[Emails, letters, or message records]
    #tick[Photographs or condition records]
  ],
  [
    #tick[Itemised calculation of amount claimed]
    #tick[Evidence for costs or disbursements]
    #tick[Latest ACRA profile, if applicable]
    #tick[Other dispute-specific evidence]
  ],
)

== Upload register

#table(
  columns: (0.32fr, 1.55fr, 1.1fr, 2fr, 0.55fr),
  inset: (x: 4pt, y: 7pt),
  stroke: 0.5pt,
  align: (center, left, left, left, center),
  table.header([*NO.*], [*FILENAME*], [*DOC TYPE*], [*DESCRIPTION*], [*PAGE*]),
  [1], [], [], [], [],
  [2], [], [], [], [],
  [3], [], [], [], [],
  [4], [], [], [], [],
  [5], [], [], [], [],
  [6], [], [], [], [],
  [7], [], [], [], [],
  [8], [], [], [], [],
)

#v(7pt)
#field("SENSITIVE OR IRRELEVANT INFORMATION TO REDACT / REMOVE BEFORE UPLOAD", height: 18mm)

#pagebreak()
= Remedy requested

More than one remedy may be selected. Complete only the applicable portions.

== Money order

#tick[I seek a money order.]
#field("VALUE CLAIMED", height: 11mm, note: "SGD")
#field("ITEMISED BASIS OF AMOUNT", height: 28mm)

== Work order

#tick[I seek a work order.]
#field("WORK ITEM TO BE PERFORMED", height: 18mm)
#field("SUBSTITUTE / ALTERNATIVE EQUIVALENT AMOUNT", height: 11mm, note: "SGD")
#field("ADDITIONAL WORK ITEM AND EQUIVALENT AMOUNT", height: 18mm)

== Costs and disbursements

#grid(
  columns: (1fr, 1fr),
  gutter: 7pt,
  [#tick[I request costs.] #field("AMOUNT / BASIS", height: 12mm)],
  [#tick[I request disbursements.] #field("AMOUNT / BASIS", height: 12mm)],
)

#notice("Evidence and discretion")[
The source guide says evidence must support a request for costs or disbursements and that any award is at the Tribunals' discretion. Its rental pre-filing example also mentions vacant possession, but the universal claim-form screenshot does not show it; use the live dispute-specific form.
]

#pagebreak()
= Final review, payment, and appointment

== Submission review

#tick[Every field marked with an asterisk in the live form is complete.]
#tick[Names, identification details, and service addresses are accurate.]
#tick[The 500-character summary matches the supporting evidence.]
#tick[Every upload opens correctly and belongs to this claim.]
#tick[The remedy and each amount are correct.]
#tick[I have reviewed the confirmation page and corrected errors.]
#tick[I can truthfully make the claimant declaration shown by CJTS.]

== Payment

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 6pt,
  choice("Internet banking"),
  choice("Credit card"),
  choice("Pay Later"),
)
#field("PAYMENT REFERENCE / RECEIPT NUMBER", height: 11mm)

#notice("Payment consequences")[
The guide says fees are not refunded for an incorrect claim. Saving a draft is not filing; the claim is filed when payment is made and a claim number is issued. A Pay Later draft is kept for three days under the source guide.
]

== Language and consultation

#tick[I understand and speak English.]
#tick[I require another language: #h(3pt) Cantonese / Hokkien / Malay / Mandarin / Tamil / Teochew / Other: #h(2pt) #line(length: 35mm, stroke: 0.5pt)]
#pair(field("CONSULTATION DATE", height: 11mm), field("CONSULTATION TIME", height: 11mm))

#notice("Hearing readiness")[
The date-selection screen warns that, unless otherwise directed, an unresolved case may be fixed for hearing on the consultation day or the following working day. If "Other" language is selected, the guide says the user must arrange a qualified interpreter, subject to Registry approval.
]

#pagebreak()
= Filing record and service

== Save these records

#pair(field("CLAIM / CASE NUMBER", height: 11mm), field("FIRST CONSULTATION DATE AND TIME", height: 11mm))
#tick[Payment receipt PDF saved.]
#tick[Claimant Copy saved - notice of consultation and claim form.]
#tick[Respondent Copy saved for every respondent.]
#tick[Correct Respondent Copy served on each respondent.]

== Respondent service record

#table(
  columns: (1.3fr, 1.45fr, 1.25fr, 1.3fr),
  inset: (x: 4pt, y: 6pt),
  stroke: 0.5pt,
  table.header([*RESPONDENT*], [*COPY / REFERENCE*], [*DATE SERVED*], [*METHOD / PROOF*]),
  [], [], [], [],
  [], [], [], [],
  [], [], [], [],
)

#v(8pt)
#notice("Service warning", strong: true)[
  The acknowledgement shown in the guide warns that the SCT may be unable to proceed if the Respondent Copy cannot be served. Where there is more than one respondent, each has a unique one-time reference number and must receive the correct copy.
]

== Final working notes

#field("QUESTIONS TO RESOLVE BEFORE CONSULTATION", height: 22mm)
#field("FOLLOW-UP ACTIONS", height: 22mm)

#v(2mm)
#line(length: 100%, stroke: 0.8pt)
#v(3pt)
#text(font: "Arial", size: 7.4pt, fill: mid)[
  Prepared from *Filing a Small Claims in CJTS - A guide to filing small claims online* (State Courts, April 2022), principally printed pages 3-9 and 24-34. Example-only rental fields are expressly marked. Verify the current live CJTS form and official directions before filing.
]

#let value(dict, key, fallback: "Not recorded") = {
  let found = dict.at(key, default: none)
  if found == none or found == "" { fallback } else { str(found) }
}

#let render-cue-card(data) = {
  set document(title: "Tribunal Cue Card", author: "Andrea")
  set page(
    paper: "a4",
    margin: (top: 8mm, bottom: 10mm, left: 10mm, right: 10mm),
    footer: context {
      set text(font: "Arial", size: 6.5pt, fill: rgb("6b7280"))
      line(length: 100%, stroke: 0.35pt + rgb("d1d5db"))
      v(1.8pt)
      grid(columns: (1fr, auto), [USE ONLY IF ACCURATE - PREPARATION AID, NOT EVIDENCE OR LEGAL ADVICE], [PAGE #counter(page).display("1")])
    },
  )
  set text(font: "Libertinus Serif", size: 10pt, fill: rgb("111827"), lang: "en")
  set par(leading: 0.42em)

  let snap = data.at("snapshot")
  let dispute = data.at("dispute")
  let claim = data.at("claimsAndRemedies")
  let facts = data.at("facts", default: ()).filter(fact => value(fact, "reviewStatus") != "REJECTED")
  let remedies = claim.at("remedies", default: ())
  let conflicts = data.at("contradictions", default: ())
  let questions = data.at("unresolvedQuestions", default: ())
  let evidence = data.at("evidenceIndex", default: ())

  let section(title) = {
    v(3pt)
    text(font: "Arial", size: 10.5pt, weight: "bold", upper(title))
    v(1.2pt)
    line(length: 100%, stroke: 0.65pt + rgb("111827"))
    v(2.2pt)
  }
  let find-fact(words) = {
    let matches = facts.filter(fact => words.any(word => lower(value(fact, "statement", fallback: "")).contains(word)))
    if matches.len() > 0 { value(matches.first(), "statement") } else { "Not recorded - explain this in your own words." }
  }
  let wanted = {
    let model = dispute.at("modelData", default: none)
    if model == none { "Not recorded - explain what you originally wanted." }
    else {
      let candidates = ("item", "scope", "premises", "proposedTransaction", "underlyingTransaction", "description")
      let found = candidates.map(key => model.at(key, default: none)).filter(item => item != none and item != "")
      if found.len() > 0 { str(found.first()) } else { "Not recorded - explain what you originally wanted." }
    }
  }
  let wanted-remedy = if remedies.len() == 0 {
    "Not recorded - state the order you want the Tribunal to make"
  } else {
    remedies.map(remedy => value(remedy, "description")).join("; ")
  }
  let fact-date(fact) = {
    let structured = fact.at("structuredValue", default: none)
    if structured == none { "DATE NOT RECORDED" } else {
      let exact = structured.at("date", default: none)
      let original = structured.at("originalWording", default: none)
      if exact != none { str(exact) } else if original != none { str(original) } else { "DATE NOT RECORDED" }
    }
  }

  [
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #text(font: "Arial", size: 8.2pt, tracking: 0.9pt, weight: "bold")[SMALL CLAIMS TRIBUNALS]
        #v(1pt)
        #text(font: "Libertinus Serif", size: 18.5pt, weight: "bold")[TRIBUNAL CUE CARD]
      ],
      [
        #text(font: "Arial", size: 8.5pt, weight: "bold", fill: rgb("374151"))[#value(snap, "displayName")]
        #v(1pt)
        #text(font: "Arial", size: 7pt, fill: rgb("6b7280"))[Reviewed snapshot #value(snap, "id")]
      ],
    )

    #v(3.5pt)
    #block(width: 100%, inset: (x: 5pt, y: 3.5pt), fill: rgb("fffbeb"), stroke: 0.45pt + rgb("92400e"))[
      #text(font: "Arial", size: 8pt, weight: "bold", fill: rgb("92400e"))[CHECK EACH LINE] #h(3pt)
      Use ordinary language. Skip anything inaccurate. Do not add facts because they sound helpful.
    ]

    #section([The five questions])
    #block(width: 100%, inset: (x: 5pt, y: 3pt), fill: rgb("f9fafb"), stroke: 0.35pt + rgb("d1d5db"))[
      *1. What did I want?* #h(4pt) #wanted #linebreak()
      *2. What was I told?* #h(4pt) #find-fact(("told", "promised", "represented", "quoted")) #linebreak()
      *3. What happened?* #h(4pt) #value(dispute, "factualSummary") #linebreak()
      *4. What did I do after?* #h(4pt) #find-fact(("complain", "contact", "refund", "returned", "report")) #linebreak()
      *5. What do I want now?* #h(4pt) #wanted-remedy
    ]

    #section([My chronology])
    #if facts.len() == 0 [No reviewed facts were saved.] else {
      text(size: 9.3pt)[
        #table(
          columns: (0.72fr, 3.4fr),
          inset: (x: 4pt, y: 2.5pt),
          stroke: 0.35pt + rgb("d1d5db"),
          table.header([*DATE / CHECK*], [*FACT TO EXPLAIN*]),
          ..facts.map(fact => (
            [#text(font: "Arial", size: 8pt, weight: "bold")[#fact-date(fact)] #linebreak() #text(size: 7pt, fill: rgb("6b7280"))[#value(fact, "reviewStatus") / #value(fact, "evidenceAssessment")]],
            [#value(fact, "statement")],
          )).flatten(),
        )
      ]
    }

    #section([Evidence prompts])
    #if evidence.len() == 0 [No evidence was included in the snapshot.] else {
      text(size: 9.3pt)[
        #table(
          columns: (1.15fr, 2.6fr, 0.35fr),
          inset: (x: 4pt, y: 2.5pt),
          stroke: 0.35pt + rgb("d1d5db"),
          table.header([*FILE*], [*WHAT IT MAY HELP EXPLAIN*], [*P.*]),
          ..evidence.map(item => (
            [#value(item, "originalFilename")],
            [#value(item, "description", fallback: "Explain only what this file shows.")],
            [#item.at("relevantPages", default: ()).map(page => str(page)).join(", ")],
          )).flatten(),
        )
      ]
    }

    #section([Points to explain])
    #if questions.len() == 0 and conflicts.len() == 0 [No unresolved questions or contradictions were saved.] else {
      if questions.len() > 0 {
        text(font: "Arial", size: 8.5pt, weight: "bold")[QUESTIONS]
        h(4pt)
        questions.map(question => [#value(question, "question") (#value(question, "status"))]).join([; ])
      }
      if questions.len() > 0 and conflicts.len() > 0 { linebreak() }
      if conflicts.len() > 0 {
        text(font: "Arial", size: 8.5pt, weight: "bold")[DIFFERENCES NOT TO HIDE]
        h(4pt)
        conflicts.map(conflict => [#value(conflict, "description") (#value(conflict, "status"))]).join([; ])
      }
    }

    #section([Final request])
    #block(width: 100%, inset: (x: 5pt, y: 3.5pt), stroke: 0.55pt + rgb("111827"))[
      "For these reasons, I respectfully ask the Tribunal to #wanted-remedy"
    ]

    #v(3pt)
    #text(size: 7.2pt, fill: rgb("6b7280"))[This cue card is a preparation aid, not evidence, an official court form, or legal advice. The attached originals remain the source documents.]
  ]
}

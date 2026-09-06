#let value(dict, key, fallback: "Not recorded") = {
  let found = dict.at(key, default: none)
  if found == none or found == "" { fallback } else { str(found) }
}

#let manifest = json(sys.inputs.at("manifest"))
#set document(title: "Tribunal Case Pack Index", author: "Andrea")
#set page(paper: "a4", margin: (top: 18mm, bottom: 18mm, left: 18mm, right: 18mm))
#set text(font: "Libertinus Serif", size: 10pt, fill: rgb("111827"), lang: "en")
#set par(leading: 0.68em)

#align(center)[
  #text(font: "Arial", size: 9pt, tracking: 1.1pt, weight: "bold")[SMALL CLAIMS TRIBUNALS]
  #v(4mm)
  #text(font: "Libertinus Serif", size: 22pt, weight: "bold")[TRIBUNAL CASE PACK]
  #v(3mm)
  #text(font: "Arial", size: 10pt, fill: rgb("4b5563"))[#value(manifest, "displayName")]
]

#v(8mm)
#table(
  columns: (1fr, 1fr),
  inset: 6pt,
  stroke: 0.45pt + rgb("d1d5db"),
  [*Generated*], [#value(manifest, "createdAt")],
  [*Snapshot*], [#value(manifest, "snapshotId")],
  [*Case revision*], [#value(manifest, "caseRevision")],
)

#v(7mm)
#text(font: "Arial", size: 13pt, weight: "bold")[DOCUMENT INDEX]
#v(3pt)
#line(length: 100%, stroke: 0.9pt + rgb("111827"))
#v(5pt)

#let documents = manifest.at("documents", default: ())
#table(
  columns: (0.45fr, 1fr, 2.4fr, 0.85fr),
  inset: 5pt,
  stroke: 0.45pt + rgb("d1d5db"),
  table.header([*NO.*], [*SECTION*], [*DOCUMENT*], [*PACK PAGES*]),
  ..documents.map(item => (
    [#value(item, "sequence")],
    [#value(item, "kind")],
    [#value(item, "title") #linebreak() #text(size: 7pt, fill: rgb("6b7280"))[SHA-256: #value(item, "sha256")]],
    [#value(item, "startPage")–#value(item, "endPage")],
  )).flatten(),
)

#v(8mm)
#block(width: 100%, inset: 8pt, fill: rgb("fffbeb"), stroke: 0.6pt + rgb("92400e"))[
  *Before using this pack:* Check the index against the included pages and bring original documents if the Tribunal directs. Cue cards and the pre-filing summary are preparation aids; they are not evidence and do not replace official court documents.
]

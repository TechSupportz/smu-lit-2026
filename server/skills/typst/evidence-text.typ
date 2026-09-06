#let source = sys.inputs.at("source")
#let title = sys.inputs.at("title")
#set document(title: title, author: "ClaimGuide evidence stack")
#set page(
  paper: "a4",
  margin: (top: 16mm, bottom: 16mm, left: 18mm, right: 18mm),
  header: [#text(font: "Arial", size: 8pt, weight: "bold")[EVIDENCE — #title]],
  footer: context [#align(right)[#text(font: "Arial", size: 7pt)[PAGE #counter(page).display("1")]]],
)
#set text(font: "DejaVu Sans Mono", size: 8.5pt)
#set par(leading: 0.55em)
#raw(read(source), block: true, lang: none)

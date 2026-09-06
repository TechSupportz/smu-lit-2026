#let source = sys.inputs.at("source")
#let title = sys.inputs.at("title")
#set document(title: title, author: "Andrea evidence stack")
#set page(paper: "a4", margin: (top: 14mm, bottom: 14mm, left: 14mm, right: 14mm))
#set text(font: "Arial", size: 8pt, fill: rgb("4b5563"))
#align(center)[
  #text(weight: "bold")[EVIDENCE — #title]
  #v(5mm)
  #image(source, width: 100%, height: 245mm, fit: "contain")
]

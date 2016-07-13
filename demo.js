const {ProseMirror} = require("prosemirror/src/edit")
const {schema} = require("prosemirror/src/schema-basic")
const {changeTracking} = require("./index")

window.pm = new ProseMirror({
  place: document.body,
  doc: schema.parseDOM(document.querySelector("#content")),
  plugins: [changeTracking.config({author: "marijn"})]
})

window.tracking = changeTracking.get(window.pm)

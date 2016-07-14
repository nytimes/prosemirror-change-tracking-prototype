const {ProseMirror} = require("prosemirror/src/edit")
const {schema} = require("prosemirror/src/schema-basic")
const {changeTracking} = require("./index")

let pm = window.pm = new ProseMirror({
  place: document.body,
  doc: schema.parseDOM(document.querySelector("#content")),
  plugins: [changeTracking.config({author: null})]
})

let tracking = window.tracking = changeTracking.get(window.pm)

const controls = document.body.appendChild(document.createElement("div"))

function updateControls() {
  controls.textContent = ""
  tracking.changes.forEach(change => {
    let div = controls.appendChild(document.createElement("div"))
    div.className = "change"
    div.appendChild(document.createElement("strong")).appendChild(document.createTextNode(change.author))
    let deleted = change.deletedText(), added = pm.doc.textBetween(change.from, change.to, " ")
    let desc = deleted ? " deleted " + JSON.stringify(deleted) : ""
    if (added) desc += (desc ? " and" : "") + " added " + JSON.stringify(added)
    div.appendChild(document.createTextNode(desc))
    div.appendChild(document.createElement("br"))
    let commit = div.appendChild(document.createElement("button"))
    commit.textContent = "Accept"
    commit.addEventListener("click", e => {
      e.preventDefault()
      tracking.acceptChange(change)
      updateControls()
    })
    div.appendChild(document.createTextNode(" "))
    let revert = div.appendChild(document.createElement("button"))
    revert.textContent = "Revert"
    revert.addEventListener("click", e => {
      e.preventDefault()
      tracking.revertChange(change)
    })
  })
}

updateControls()
pm.on.change.add(() => setTimeout(updateControls, 50))

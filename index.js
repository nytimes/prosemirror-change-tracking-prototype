const {Plugin} = require("prosemirror/src/edit")
const {Transform} = require("prosemirror/src/transform")

class TrackedChange {
  constructor(from, to, old, author) {
    this.from = from
    this.to = to
    this.old = old
    this.author = author
  }

  map(mapping, inclusive) {
    let from = mapping.map(this.from, inclusive ? -1 : 1)
    let to = mapping.map(this.to, inclusive ? 1 : -1)
    if (from > to || from == to && !this.old.size) return null
    return new TrackedChange(from, to, this.old, this.author)
  }
}

function applyAndSlice(doc, changes, from, to) {
  let tr = new Transform(doc)
  for (let i = changes.length - 1; i >= 0; i--) {
    let change = changes[i]
    tr.replace(change.from, change.to, change.old)
  }
  return tr.doc.slice(from, tr.map(to))
}

function findDiff(a, b, pos) {
  let start = a.findDiffStart(b, pos)
  if (!start) return null
  let {a: endA, b: endB} = a.findDiffEnd(b, pos + a.size, pos + b.size)
  if (endA < start) {
    endB += start - endA
    endA = start
  }
  if (endB < start) {
    endA += start - endB
    endB = start
  }
  return {start, endA, endB}
}

function minimizeChange(change, doc) {
  let changedDoc = new Transform(doc).replace(change.from, change.to, change.old).doc

  let $from = doc.resolve(change.from), sameDepth = $from.depth
  while (change.to > $from.end(sameDepth)) --sameDepth

  let node = $from.node(sameDepth)
  let nodePos = $from.before(sameDepth)
  let changedNode = changedDoc.nodeAt(nodePos)

  let diff = findDiff(node.content, changedNode.content, nodePos + 1)
  if (!diff) return null
  if (diff.start == change.from && diff.endA == change.to) return change
  if (diff.endA < diff.start) console.log("OUCH", diff, change.from, node.content + " - " + changedNode.content)
  return new TrackedChange(diff.start, diff.endA, changedDoc.slice(diff.start, diff.endB), change.author)
}

function mapChanges(changes, map, author, updated, docAfter) {
  let result = []
  for (let i = 0; i < changes.length; i++) {
    let change = changes[i], mapped = change.map(map, author == change.author)
    if (mapped) {
      if (updated && updated.indexOf(change) > -1)
        mapped = minimizeChange(mapped, docAfter)
      if (mapped) result.push(mapped)
    }
  }
  return result
}

exports.changeTracking = new Plugin(class ChangeTracking {
  constructor(pm, options) {
    this.pm = pm
    this.changes = options.changes.slice()
    this.annotations = []
    this.author = options.author
    pm.on.transform.add(this.onTransform = this.onTransform.bind(this))
  }

  detach() {
    this.pm.on.transform.remove(this.onTransform)
  }

  onTransform(transform) {
    if (!this.author) // FIXME split changes when typing inside them?
      this.changes = mapChanges(this.changes, transform)
    else
      this.record(transform, this.author)
    this.updateAnnotations()
  }

  record(transform, author) {
    let updated = []
    for (let i = 0; i < transform.steps.length; i++) {
      let map = transform.maps[i]
      for (let r = 0; r < map.ranges.length; r += 3)
        this.recordRange(transform.docs[i], map.ranges[r], map.ranges[r] + map.ranges[r + 1], author, updated)
      this.changes = mapChanges(this.changes, map, author, updated, transform.docs[i + 1] || transform.doc)
      updated.length = 0
    }
  }

  recordRange(doc, from, to, author, updatedChanges) {
    let i = 0
    for (; i < this.changes.length; i++) {
      let change = this.changes[i]
      if (change.author != author || change.to < from) continue
      if (change.from > to) break

      let changes = [change], newContent = from < change.from || to > change.to

      for (let j = i + 1; j < this.changes.length; j++) {
        let next = this.changes[j]
        if (next.author != author) continue
        if (next.from > to) break

        changes.push(next)
        newContent = true
        this.changes.splice(j, 1)
      }

      let newFrom = Math.min(change.from, from), newTo = Math.max(changes[changes.length - 1].to, to)
      let slice = newContent ? applyAndSlice(doc, changes, newFrom, newTo) : change.old
      updatedChanges.push(this.changes[i] = new TrackedChange(newFrom, newTo, slice, change.author))
      return
    }
    this.changes.splice(i, 0, new TrackedChange(from, to, doc.slice(from, to), author))
  }

  updateAnnotations() {
    // See if our document annotations still match the set of changes,
    // and update them if they don't.
    let iA = 0
    for (let iC = 0; iC < this.changes.length; iC++) {
      let change = this.changes[iC], matched = false
      let deletedText = change.old.content.textBetween(0, change.old.content.size, " ")
      while (iA < this.annotations.length) {
        let ann = this.annotations[iA]
        if (ann.from > change.to) break
        if (ann.from == change.from && ann.to == change.to && ann.options.deletedText == deletedText) {
          iA++
          matched = true
        } else {
          this.pm.removeRange(ann)
          this.annotations.splice(iA, 1)
        }
      }
      if (!matched) {
        let ann = this.pm.markRange(change.from, change.to, rangeOptionsFor(change, deletedText))
        this.annotations.splice(iA++, 0, ann)
      }
    }
    for (let i = iA; i < this.annotations.length; i++) {
      this.pm.removeRange(this.annotations[iA])
    }
    this.annotations.length = iA
  }
}, {
  changes: [],
  author: null
})

function rangeOptionsFor(change, deletedText) {
  let options = {}
  if (change.from == change.to) options.removeWhenEmpty = false
  else options.className = "inserted"
  if (deletedText) {
    options.deletedText = deletedText
    let elt = options.elementBefore = document.createElement("span")
    elt.textContent = deletedText
    elt.className = "deleted"
  }
  return options
}

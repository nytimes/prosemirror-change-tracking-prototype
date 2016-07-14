const {Plugin} = require("prosemirror/src/edit")
const {Slice} = require("prosemirror/src/model")
const {Transform} = require("prosemirror/src/transform")

class TrackedChange {
  constructor(start, end, old, author) {
    this.start = start
    this.end = end
    this.old = old
    this.author = author
  }

  map(mapping, inclusive) {
    let start = mapping.map(this.start, inclusive ? -1 : 1)
    let end = mapping.map(this.end, inclusive ? 1 : -1)
    if (start > end || start == end && !this.old.size) return null
    return new TrackedChange(start, end, this.old, this.author)
  }
}

function filterMap(arr, f) {
  let result = []
  for (let i = 0; i < arr.length; i++) {
    let val = f(arr[i])
    if (val) result.push(val)
  }
  return result
}

function applyAndSlice(doc, changes, start, end) {
  let tr = new Transform(doc)
  for (let i = changes.length - 1; i >= 0; i--) {
    let change = changes[i]
    tr.replace(change.start, change.end, change.old)
  }
  return tr.doc.slice(start, tr.map(end))
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

  // FIXME handle undo specially somehow. Undo of delete currently
  // ends up adding a new version of the content to the tracked
  // change. (Might be able to cut it down with diffing)
  onTransform(transform) {
    if (!this.author) // FIXME split changes when typing inside them?
      this.changes = filterMap(this.changes, ch => ch.map(transform))
    else
      this.record(transform, this.author)
    this.updateAnnotations()
  }

  record(transform, author) {
    for (let i = 0; i < transform.steps.length; i++) {
      let map = transform.maps[i]
      for (let r = 0; r < map.ranges.length; r += 3)
        this.recordRange(transform.docs[i], map.ranges[r], map.ranges[r] + map.ranges[r + 1], author)
      this.changes = filterMap(this.changes, ch => ch.map(map, ch.author == author))
    }
  }

  recordRange(doc, start, end, author) {
    let i = 0
    for (; i < this.changes.length; i++) {
      let change = this.changes[i]
      if (change.author != author || change.end < start) continue
      if (change.start > end) break

      let changes = [change], newContent = start < change.start || end > change.end

      for (let j = i + 1; j < this.changes.length; j++) {
        let next = this.changes[j]
        if (next.author != author) continue
        if (next.start > end) break

        changes.push(next)
        newContent = true
        this.changes.splice(j, 1)
      }

      let newStart = Math.min(change.start, start), newEnd = Math.max(changes[changes.length - 1].end, end)
      let slice = newContent ? applyAndSlice(doc, changes, newStart, newEnd) : change.old
      this.changes[i] = new TrackedChange(newStart, newEnd, slice, change.author)
      return
    }
    this.changes.splice(i, 0, new TrackedChange(start, end, doc.slice(start, end), author))
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
        if (ann.from > change.end) break
        if (ann.from == change.start && ann.to == change.end && ann.options.deletedText == deletedText) {
          iA++
          matched = true
        } else {
          this.pm.removeRange(ann)
          this.annotations.splice(iA, 1)
        }
      }
      if (!matched) {
        let ann = this.pm.markRange(change.start, change.end, rangeOptionsFor(change, deletedText))
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
  if (change.start == change.end) options.removeWhenEmpty = false
  else options.className = "inserted"
  if (deletedText) {
    options.deletedText = deletedText
    let elt = options.elementBefore = document.createElement("span")
    elt.textContent = deletedText
    elt.className = "deleted"
  }
  return options
}

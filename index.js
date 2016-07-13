const {Plugin} = require("prosemirror/src/edit")
const {Slice} = require("prosemirror/src/model")

function appendSlice(a, b) {
  if (!a.size) return b
  if (!b.size) return a
  // FIXME this is a trivial impl, needs to be properly implemented
  if (a.openLeft || a.openRight || b.openLeft || b.openRight || !a.possibleParent.sameMarkup(b.possibleParent))
    throw new RangeError("Complex slices not supported yet")
  return new Slice(a.content.append(b.content), 0, 0, a.possibleParent)
}

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
    if (!this.author)
      this.changes = filterMap(this.changes, ch => ch.map(transform))
    else
      this.record(transform)
    this.annotate()
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

      let slice = change.old, sliceEnd = change.end
      if (start < change.start) slice = appendSlice(doc.slice(start, change.start), slice)

      for (let j = i + 1; j < this.changes.length; j++) {
        let next = this.changes[j]
        if (next.author != author) continue
        if (next.start > end) break

        slice = appendSlice(appendSlice(slice, doc.slice(sliceEnd, next.start)), next.old)
        sliceEnd = next.end
        this.changes.splice(j, 1)
      }

      if (end > sliceEnd) slice = appendSlice(slice, doc.slice(sliceEnd, end))
      this.changes[i] = new TrackedChange(Math.min(change.start, start), Math.max(sliceEnd, end),
                                          slice, change.author)
      return
    }
    this.changes.splice(i, 0, new TrackedChange(start, end, doc.slice(start, end), author))
  }

  // FIXME take a more efficient approach here
  // (or wait for intelligent annotation diffing in a later PM release)
  annotate() {
    this.annotations.forEach(a => this.pm.removeRange(a))
    this.annotations = this.changes.map(ch => this.pm.markRange(ch.start, ch.end, {className: "inserted"}))
  }
}, {
  changes: []
})

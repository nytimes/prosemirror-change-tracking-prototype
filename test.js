const {ProseMirror} = require("prosemirror/src/edit")
const {schema} = require("prosemirror/src/schema-basic")
const {changeTracking} = require("./index")

let filter = document.location.hash.slice(1), failed = 0

function test(name, content, ...rest) {
  if (filter && name != filter) return

  let result = rest.pop()
  let pm = new ProseMirror({
    doc: schema.nodes.doc.create(null, content.split("\n").map(para => schema.nodes.paragraph.create(null, schema.text(para)))),
    plugins: [changeTracking.config({author: "x"})]
  })
  rest.forEach(change => change(pm))
  let found = changeTracking.get(pm).changes.map(ch => ch.from + "-" + ch.to + "" + ch.deleted.content).join(" ")
  if (found != result) {
    output("Unexpected outcome in <a href='#" + name + "'>" + name + "</a>:\n  " + found.replace(/</, "&lt;") + "\n  " + result.replace(/</, "&lt;"))
    failed++
  }
}

function output(text) {
  document.querySelector("#output").innerHTML += text + "\n"
}

function ins(at, text, end) {
  return pm => pm.tr.replaceWith(at, end || at, pm.schema.text(text)).apply()
}

function undo(pm) { return pm.history.undo() }

function split(at) {
  return pm => pm.tr.split(at).apply()
}

function del(from, to) {
  return pm => pm.tr.delete(from, to).apply()
}

test("simple_add", "foo",
     ins(2, "hi"),
     "2-4<>")

test("add_twice", "foo",
     ins(4, "ok"), ins(1, "hi"),
     "1-3<> 6-8<>")

test("add_adjacent", "foo",
     ins(2, "x"), ins(3, "x"), ins(2, "x"),
     "2-5<>")

test("simple_del", "foobar",
     del(2, 4),
     '2-2<"oo">')

test("del_adjacent", "foobar",
     del(2, 4), del(2, 4),
     '2-2<"ooba">')

test("add_del", "foobar",
     ins(4, "aa"), del(2, 4),
     '2-4<"oo">')
     
test("del_add", "foobar",
     del(2, 4), ins(2, "aa"),
     '2-4<"oo">')

test("join_adds", "foobar",
     ins(2, "xy"), ins(7, "zz"), del(3, 8),
     '2-4<"oob">')

test("join_adds_around", "foobar",
     ins(2, "xy"), ins(7, "zz"), del(1, 9),
     '1-1<"foob">')

test("join_three_adds", "foobar",
     ins(2, "xy"), ins(5, "zz"), ins(8, "qq"), del(3, 9),
     '2-4<"oo">')

test("add_del_cancel", "foo",
     ins(2, "ab"), del(2, 4),
     "")

test("del_add_cancel", "foo",
     del(2, 4), ins(2, "oo"),
     "")

test("add_del_cancel_separate", "foo",
     ins(2, "a"), ins(3, "b"), del(3, 4), del(2, 3),
     "")

test("del_add_cancel_separate", "foo",
     del(3, 4), del(2, 3), ins(2, "o"), ins(3, "o"),
     "")

test("del_and_undo", "abcde",
     del(4, 5), del(3, 4), del(2, 3), undo,
     "")

test("del_add_cancel_separate_matching_context", "fababab",
     del(4, 5), del(3, 4), del(2, 3), ins(2, "a"), ins(3, "b"), ins(4, "a"),
     "")

test("insert_multiple_after_identical", "abc",
     ins(2, "a"), ins(3, "a"),
     '2-4<>')

test("insert_identical_delete_in_front", "abc",
     ins(4, "bcbc"), del(2, 4),
     '4-6<>')

test("del_paragraph", "foo\nbar\nbaz",
     del(4, 11),
     '4-4<paragraph, paragraph("bar"), paragraph>')

test("create_paragraph", "foobar",
     split(4),
     '4-6<>')

test("create_then_del_paragraph", "foobar",
     split(4), del(4, 6),
     "")

test("del_then_restore_paragraph", "foo\nbar",
     del(4, 6), split(4),
     "")

output(failed ? failed + " tests failed" : "All passed")

window.onhashchange = () => location.reload()

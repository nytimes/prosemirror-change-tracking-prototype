# ProseMirror change tracking proof-of-concept

This repository contains a basic implementation of change tracking for
ProseMirror. The index.js file exports a ProseMirror plugin
`changeTracking` which, when added to an editor, will keep a set of
changes in sync with the editor's document, and, if its `author`
property is set, record newly made changes.

This project is a prototype built to explore the possibility of porting
track changes to ProseMirror. We are releasing it as free software for
the benefit of the ProseMirror community to learn from. We may not be
continuing development on this, but feel free to open an issue if you
would like to report or fix a bug.

## Interface

The `changeTracking` plugin takes two options, `changes`, which may be
an array of `TrackedChange` objects, and `author`, which can be used
to initialize it with change tracking enabled.

You can access its state with `changeTracking.get(editorInstance)`.
The object that'll return has the following properties:

**`changes`**`: [TrackedChange]`

The current tracked changes.

**`author`**`: any`

When non-null, change tracking is enabled, and recorded changes will
be tagged with this value. Should be comparable with `==` (only
changes with the same author are combined when adjacent).

**`acceptChange`**`(TrackedChange)`

Accept (forget) the given change.

**`revertChange`**`(TrackedChange)`

Revert (undo) the given change.

### class `TrackedChange`

A tracked change object has the following fields:

**`from`**`: number`, **`to`**`: number`

The start and end of the content inserted by this change.

**`deleted`**`: Slice`

The content deleted by this change.

**`author`**`: any`

The author value associated with the change.

The class' constructor takes these same values, `(from, to, deleted,
author)`.

## Caveats

 - This relies on a kludged-in ProseMirror feature for showing deleted
   text inline. The package.json file points at a branch on github
   that implements this, since it is not in any release.

 - Does not work with the collaborative editing plugin yet. Also, if
   you use `setDoc` while using this plugin, you have to manually
   reset the plugin as well.

To run the demo (defined in `index.html` and `demo.js`), `npm install`
this directory, start the demo server with `npm run demo`, and point
an ECMAScript 6-capable browser at
[`http://localhost:8000/`](http://localhost:8000/).

To run the test suite, open
[`test.html`](http://localhost:8000/test.html).

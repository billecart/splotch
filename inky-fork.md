# Inky Fork — Design Specification (v0.1)

## Product intent

Create a personal fork of Inky that makes large Ink scripts faster to read, navigate, test, and revise without changing how Ink is compiled or consumed by Unreal Engine.

The fork is an editor enhancement, not a new Ink dialect. Existing `.ink` files must retain their exact meaning in the stock Inky compiler and the Unreal integration.

The reference script for this specification is `Test_B0-8_Loc01.ink`, a narrative script that uses knots, choices, diverts, conditions, inline logic, comments, Unicode, HTML `<br>` elements, and production tags.

## Users and workflow

The primary user writes Ink for an Unreal Engine narrative project and frequently needs to:

1. Scan a large script and immediately understand its structure and production metadata.
2. Jump from a divert target to its knot declaration.
3. Start a preview at the knot currently being edited.
4. See which dialogue lines have already been voiced/performed.
5. Mark selected passages for a later writing pass without affecting a co-writer's source files.

## Guardrails

- Do not rewrite, format, normalize, or add tags to `.ink` files automatically.
- Do not change Ink compilation, story JSON, exported files, or Unreal-facing data.
- Continue supporting all valid existing Ink syntax, including Unicode and HTML-like text such as `<br>`.
- Preserve stock Inky's existing knot outline/sidebar and its existing debug-redirect workflow.
- Production IDs are protected: never generate, rename, remove, or modify them automatically.
- All v0.1 annotations are local-only and must never be written into an `.ink` file.

## Scope: v0.1

### 1. Ink syntax highlighting

Add a syntax-highlighting layer to the source editor. It must refresh promptly while typing and must not alter the document text.

Highlight standard Ink constructs distinctly:

- Knot declarations (`=== knot_name ===`) and stitches.
- Diverts and their targets (`-> knot_name`), including conditional/sequence syntax where applicable.
- Choices, including once-only and sticky choice markers (`*`, `+`) and choice text.
- Variables, assignments, function calls, inline expressions, conditions, braces, and operators.
- Comments, in a muted style.
- Tags.

Use visibly distinct, theme-appropriate colours for the following project tag types:

| Tag type | Examples | Treatment |
|---|---|---|
| Speaker | `# speaker:tempest`, `# speaker:leda` | Speaker-tag colour |
| Protected voice-line ID | `# id:EP01_LEDA_001` | Dedicated protected-ID colour |
| Text / presentation effect | `# bold`, `# dim`, `# break`, `# delay:3.0` | Effect-tag colour |
| Narrative / visual effect | `# unstable:LOCK`, `# ghost:1.6`, `# redact:1.5` | Narrative-effect colour |
| Unknown custom tag | future tags such as `# ledger:…` | Neutral custom-tag colour; must remain valid and readable |

Recognize both bare tags and key/value tags after dialogue lines. Follow Ink's actual tag grammar; the editor must not repair invalid source. The reference script's `radio…# speaker:nic` omission of whitespace is a source typo, not a formatting convention to introduce.

Exact colours may follow Inky's active theme, but categories must remain clearly distinguishable and readable in both light and dark themes.

### 2. Knot navigation

Keep the stock knot outline/sidebar. Add navigation without replacing it:

- Right-click a divert target and choose **Go to knot declaration**.
- The command opens the target knot and places the cursor on its declaration.
- If the target cannot be resolved in the open story/project, show a concise non-destructive message and leave the source unchanged.
- The command must work on ordinary active diverts.
- Do not regress existing `//-> knot_name` debug redirects: they must preserve their current Inky navigation/debug behavior even though ordinary comments are visually muted.

No tag sidebar or tag browser is part of v0.1.

### 3. Test the selected knot in preview

Provide **Test this knot** in the knot-outline context menu and in the editor right-click menu when the cursor is inside a knot.

Behavior:

1. Resolve the enclosing or selected knot.
2. Compile using the normal Inky pipeline.
3. Reset preview/story state.
4. Start the preview at that knot.
5. Preserve the normal compile-error display if the script cannot compile.

The feature is for isolated testing. It does not attempt to recreate state accumulated by the normal story path in v0.1.

### 4. Performed-line display

Add a persistent editor toggle named **Show performed lines**. It is off by default.

When enabled, give a dialogue line a subtle light-grey full-line background when that line contains a non-empty `# id:` tag. These IDs represent voiced/performed production lines; no particular `EP01_…` naming pattern should be required.

- This is display-only: it must not change Ink text, tags, compilation, preview output, or Unreal data.
- The colouring updates after edits, undo/redo, and file reload.
- A user-created yellow text highlight takes visual precedence over the grey line background, so both signals remain legible.

### 5. Local writing highlights

Allow the writer to select any text in the source editor and use **Highlight selection** from the right-click menu. The selected range receives a yellow text background.

- **Remove highlight** removes the highlight from the selected/target range.
- Add **Next highlight** and **Previous highlight** commands so highlights function as revisit markers.
- Persist highlights locally in the application's user data, keyed to the source file and anchored with enough surrounding text to survive ordinary line insertions/deletions.
- Highlights should restore when the file is reopened or updated from Git when their text anchor still resolves.
- v0.1 annotations are private to the local user. They are not written into the `.ink` file, versioned, synced, exported, or shared with co-writers.

## Out of scope for v0.1

- A tag outline/sidebar, tag search, or tag filters.
- Automatic voice-line ID generation or editing.
- Duplicate/missing-ID validation (a possible later feature).
- Shared or Git-tracked annotations.
- A custom Ink compiler, new tag syntax, or modifications to the Unreal integration.
- Preserving story state when jumping directly to a knot in preview.

## Acceptance criteria

Using `Test_B0-8_Loc01.ink` (and equivalent production files):

1. Standard Ink structure and all listed tag categories receive stable, distinct highlighting with no source edits.
2. Tags such as `# speaker:tempest`, `# id:EP01_LEDA_001`, `# bold`, and `# unstable:LOCK` render in their appropriate categories.
3. A right-click on `-> scn_first_contact` navigates to `=== scn_first_contact ===`.
4. Existing debug redirects such as `//-> enc_kat` retain their current behavior.
5. **Test this knot** from `scn_base_escape` resets the preview and starts there.
6. With **Show performed lines** enabled, every line with `# id:` has a subtle grey background; lines without `# id:` do not.
7. A selected text range can be yellow-highlighted, reopened later, navigated with Next/Previous highlight, and removed without changing the `.ink` file.
8. A script containing the same text produces the same compiled result in stock Inky and the fork.

## Suggested implementation order

1. Establish the fork and confirm the unmodified app builds and runs.
2. Implement syntax tokenization/highlighting with tests based on the reference script.
3. Add divert-to-knot context navigation, preserving debug redirects.
4. Add **Test this knot** with a reset-state preview start.
5. Add the performed-line toggle.
6. Add local selected-text highlights and navigation.

## Later decisions

- Define a shared-annotation format only after local highlights have proven useful.
- Consider protected-ID diagnostics (duplicate IDs, missing IDs, malformed IDs) as a read-only validation tool.
- Consider configurable tag colours only if the fixed category colours become limiting.

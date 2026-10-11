# Goal notes

## Goal 1 — scaffold and build pipeline

- Electron security defaults: context isolation enabled, Node integration disabled, typed preload bridge.
- Vite + React + TypeScript renderer; Electron main/preload compiled separately.
- GitHub Actions packages unsigned universal macOS DMG and Windows NSIS artifacts.
- OS-specific packaging is isolated to electron-builder configuration.
- Major dependencies: Electron (desktop shell), React/Vite (UI), Tiptap (structured editor), Zustand (state), Zod (file validation), Vitest/Playwright (verification).
- Local Windows launch and CI artifact production still require runtime verification.

## Goal 2 — lined page and editor

- Tiptap schema is limited to paragraphs, two heading levels, bullet lists, bold, italic, underline, and text color.
- Ruling and editor use the same CSS `--line` token. Headings consume two ruled lines.
- Three selectable font profiles record baseline offset and size scale. Redistribution requires replacing development system fallbacks with bundled OFL files.
- Automated schema tests cover profile completeness; the Playwright screenshot covers the ruled page. Full font-by-size golden screenshots remain unverified.

## Goal 3 — hard-stop pages and creation

- Creation eagerly makes 20–100 fixed pages. Schema rejects mismatched page counts.
- DOM height enforcement rolls back the transaction that crosses the page boundary and marks the page full.
- Debounced autosave goes through validated atomic temp-file replacement.

## Goal 4 — stickers and stamps

- Original typographic CC0 glyph assets support placement and deletion; page actions participate in shared undo/redo.
- Stamps have configurable ink data, per-placement seed, and slight random rotation.
- Resize, rotation UI, layering controls, duplicate, repeat-on-hold, and persisted drag coordinates are known gaps.

## Goal 5 — notebook, spread, and animation

- Desk, closed notebook, responsive two/single-page spread, navigation, CSS page flip, animation preference, and reduced-motion support are implemented.
- Responsive Playwright acceptance test asserts text remains on its page.

## Goal 6 — cover designer

- Material, cover/spine colors, and label are editable and shown on the closed notebook.
- Cover sticker/stamp placement reusing the page layer remains a known gap.

## Goal 7 — customization

- Paper, ruling, margin, text, desk, ruling type, font, cover, and spine values are schema-backed and editable.

## Goal 8 — lock and PDF

- AES-256-GCM authenticated encryption uses scrypt with a random 16-byte salt and 12-byte IV. Tests cover plaintext absence, wrong-passcode rejection, and round-trip.
- Electron `printToPDF` uses the print renderer and retains text as text. Visual PDF comparison remains a manual check.

## Goal 9 — stretch

- Not attempted. The flat animation remains behind the animation setting as planned.

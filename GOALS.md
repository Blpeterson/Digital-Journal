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

## 2026 platform, reliability, and polish hand-off

- Supported desktop targets are now Windows 10/11 and macOS 26/27. The macOS deployment target is isolated in `package.json` (`build.mac.minimumSystemVersion`); runtime platform behavior remains behind Electron/main-process IPC interfaces. Electron 42 replaces the unsupported Electron 37 line.
- Saves for each notebook are serialized. Each save uses a unique same-directory temporary file, flushes and validates it before replacement, retains the previous file as `.lnb.backup`, and verifies the installed file. The editor shows saving/saved/failure state and keeps the open notebook in memory after failure.
- PDF export uses a separate, non-interactive A4 print renderer and includes the front cover, every fixed page, and the back cover. It waits for fonts and every page editor before printing.
- The decoration tray has additional original Unicode-based stickers and stamps. Placed decorations and locally embedded photos have manual 15-degree rotation controls.
- Photo placement was added at the user's explicit direction, overriding the earlier no-photos scope note. Photos remain entirely local and are embedded in the `.lnb` file; no sync or network feature was added.
- No new runtime dependency was required for save recovery, PDF rendering, decoration rotation, or photos.

## 2026 notebook feature expansion

- Recovery Center lists verified `.lnb.backup` files and restores them while preserving the current file as a timestamped pre-restore copy.
- Decorations support resize, manual rotation, layer changes, duplication, locking, deletion, and keyboard movement. Photos add crop/fit, crop focus, four frames, filters, and captions.
- Page thumbnails, persistent visual bookmarks, section tabs, colored dividers, clear/duplicate/reorder controls, and seven page templates were added without search or tags. Fixed page counts remain enforced.
- Front-cover stickers, stamps, and photos render consistently on the shelf, closed notebook, designer, and PDF cover.
- Pen, translucent highlighter, and stroke eraser tools store vector points in the notebook and print with the page.
- PDF export supports page ranges, optional covers, A4/Letter output, tags, and an outline. Portable `.lnb` backup copies use the same verified write path.
- Presentation mode, optional generated page-turn audio, high contrast, 80–140% zoom, keyboard movement, and screen-reader decoration labels improve presentation and accessibility.
- Paper textures and richer writing controls (numbered lists, quotes, dividers, checkboxes, date headings) remain schema-backed or editor-schema-native.
- No dependencies or third-party assets were added for this expansion. OS-specific filesystem and print operations remain behind preload/main-process interfaces.

# Lined Notebook App: Codex Hand-off

Oct 10, 2026 · @Bracken

Build a local-only, open-source desktop app (macOS Intel and Apple Silicon, Windows) where writing feels like typing in a real lined notebook you open, decorate, and fill with stickers. This is not an Apple Notes extension: Notes has no plugin API, so the app is standalone.

## Product brief and locked decisions

The app is a notebook object, not a document window. In full screen you see a desk and a closed notebook; you open it and write on lined pages. Everything below is decided.

| Area | Decision |
| --- | --- |
| Platforms | macOS (universal: Intel + Apple Silicon) and Windows. Linux is dropped for now. |
| License / audience | Open source, free, personal use first. No signing, auto-update or notarization in v1. |
| Data | Fully local. No sync, no accounts, no AI features. |
| Input | Typing only, with bold, italic, underline, headings and bullet lists. No handwriting, no tables, no inline images. |
| Fonts | Bundled open-license fonts, including cursive and curvy script faces. No user font import. |
| Notebook size | Chosen at creation: 20 to 100 pages. Fixed afterward: no insert, delete or reorder. |
| Page end | Hard stop. Text cannot overflow; the page is full. |
| Layout | Two-page spread in full screen, one page when the window is narrow. |
| Stickers and stamps | Open-source or CC0 art only. Place, move, resize, rotate (angle). No shadows. Stamps behave differently from stickers (see goals). No photos, no user-imported images. |
| Cover | Custom colors, materials, title label, stickers and stamps on the cover. |
| Customization | Free color picker for cover, paper and text. No theme sharing. |
| Animation | Open/close and page turn are optional (setting). First pass is a cheap CSS 3D swing and flip; true page curl is the later goal. |
| Lock | Optional passcode per notebook, with real encryption of the file. |
| Export | PDF of the whole notebook: cover, every page, lines, text, stickers and stamps. |
| Search, tags, folders | None. A bookshelf of notebooks is enough. |

## Calls I made where you said "figure it out"

- **Line spacing is a notebook setting, not a font setting.** At creation you pick a ruling height (narrow, college, wide). Text sizes are limited to steps that fit it, and every line of text, heading and bullet occupies a whole number of ruled lines. Free-sizing text is what makes text drift off the lines, so it is not offered.
- **Headings** take two ruled lines. **Bullets** put the dot in the margin, one item per line, with wrapped lines hanging under the text and still sitting on the lines.
- **Style is per notebook, not per page.** Paper color, ruling style and color, margin line, default text color and default font live on the notebook. You can still change font, color and size on any selected text, so a page can mix them. Per-page overrides add data and UI for little gain.
- **Cursive and curvy fonts need a metrics profile.** Each bundled font gets a stored baseline offset and size scale so its letters sit on the line. Fonts without a profile are not shipped.
- **One file per notebook, not SQLite.** A notebook is a single package (JSON plus its sticker and font assets). This makes the passcode lock, PDF export and backup simple: copy one file.
- **The lock uses real encryption.** AES-256-GCM with a key derived from the passcode (scrypt). A forgotten passcode cannot be recovered, and the app must say so when the lock is set.
- **Page curl is staged.** Goal 5 ships a flat CSS 3D cover swing and page flip. Goal 9 replaces the page turn with a WebGL curl (three.js shader), behind the same animation interface, so nothing else changes.
- **PDF export uses the same renderer as the screen** (Electron's printToPDF with a print stylesheet), so text stays vector and the lines and stickers match what you see.

## Stack and repo layout

| Concern | Choice |
| --- | --- |
| Shell | Electron, `contextIsolation` on, `nodeIntegration` off, typed IPC for all file access |
| UI | React, TypeScript, Vite |
| Editor | Tiptap (ProseMirror) with a minimal schema: paragraph, heading, bullet list, bold, italic, underline |
| Stickers | Absolutely positioned DOM layer over the page |
| Animation | CSS 3D transforms first; three.js page curl in goal 9 |
| State | Zustand |
| Storage | One package file per notebook, atomic writes, encrypted when locked |
| Packaging | electron-builder: universal macOS dmg, Windows NSIS installer |
| CI | GitHub Actions on macOS and Windows runners, unsigned artifacts per push |
| Tests | Vitest for logic, Playwright for screenshot and UI checks |

```text
/src/main        window, menus, IPC, file and crypto access
/src/preload     contextBridge API
/src/renderer
  /desk          desk scene, closed notebook, open/close
  /spread        two-page and one-page layouts, page turn
  /editor        Tiptap setup, line-grid alignment, font and color controls
  /stickers      sticker layer, tray, stamp tool
  /cover         cover designer
  /library       bookshelf, new-notebook flow, lock screen
/packages/schema shared types and Zod validators
/packages/assets stickers, stamps, textures, fonts, plus LICENSES.md
AGENTS.md        rules for Codex
```

## Non-negotiable design rules

1. **Text sits on the lines.** Draw the ruling and set the editor `line-height` from the same ruling-height value, in the same scroll container. Never set line-height independently.
2. **A page has three layers:** paper (color, ruling, margin line), text (Tiptap), stickers (on top). Stickers use page coordinates and never reflow with text.
3. **Hard stop.** A page holds a fixed number of ruled lines. When the last line is full, typing is blocked on that page and the page shows it is full. Do not auto-create pages or scroll.
4. **Fixed page size**, one aspect ratio for the whole notebook. Spread view shows two pages, and below a width threshold shows one. Page content must not change between the two views.
5. **Stickers and stamps differ.** Stickers: drag, resize, rotate, layer up and down, duplicate, delete. Stamps: click to place, adjustable ink color, small random rotation and ink roughness on each placement, repeatable while the mouse is held. No shadows on either.
6. **Everything visual is data.** Colors, materials, rulings and fonts come from the schema and theme tokens. No hard-coded visual values in components.
7. **Animations are optional.** A setting turns open/close and page turn off; respect the OS reduced-motion setting by default.
8. **Undo and redo** cover text and sticker actions.

## Data model

```text
Notebook  { id, title, pageCount (20-100), pageSize, style: NotebookStyle,
            cover: CoverDesign, lock?: { salt, kdfParams }, pages: Page[], createdAt }
NotebookStyle { paperColor, ruling: lined|dotted|grid|blank, rulingHeight,
            rulingColor, marginLine, defaultTextColor, defaultFont, deskBackground }
CoverDesign { material, color, texture, spineColor, band?, label: { text, font, color },
            stickers[], stamps[] }
Page      { index, content: TiptapJSON, stickers: StickerInstance[], stamps: StampInstance[] }
StickerInstance { id, assetId, x, y, rotation, scale, z, tint? }
StampInstance   { id, assetId, x, y, rotation, scale, inkColor, seed }
Asset     { id, kind: sticker|stamp|texture|font, path, license, source }
FontProfile { family, baselineOffset, sizeScale, license }
```

Pages are created empty when the notebook is created, so page count never changes afterward.

## Goals, in order

Run goals 1 to 8 in one pass, in order, without stopping for approval. Goal 9 is the stretch. After each goal, commit and note what was verified and what was not. A goal is finished only when its done-when check passes.

1. **Scaffold and build pipeline.** Electron, Vite, React, TypeScript, lint, tests, schema package, `AGENTS.md`. CI builds a universal macOS dmg and a Windows installer on every push. *Done when:* `npm run dev` opens a window on both OSes and CI produces both installers.
2. **Lined page and editor.** One page with paper, ruling, margin line and Tiptap. Size steps tied to ruling height; headings take two lines; bullets use the margin; font and color controls; bundled fonts with metric profiles. *Done when:* a screenshot test shows baselines on the lines for every bundled font at every size step, including the cursive ones.
3. **Hard-stop pages and notebook creation.** New-notebook flow (title, 20 to 100 pages, ruling height, paper). Fixed lines per page, blocked typing when full. Persistence with autosave and atomic writes. *Done when:* typing to the end of a page stops cleanly, and quitting mid-typing and relaunching loses nothing.
4. **Stickers and stamps.** Tray with categories, built-in CC0 and open-license art with `LICENSES.md`, place, move, resize, rotate, layer, duplicate, delete, undo and redo, and the stamp behavior from the design rules. *Done when:* a scrapbooked page reloads identically.
5. **Notebook object, spread and animation (cheap version).** Full-screen desk, closed notebook, CSS 3D cover swing, two-page spread, one page when narrow, flat page flip, arrow keys and edge clicks, animation toggle in settings. *Done when:* resizing across the threshold never loses or moves content.
6. **Cover designer.** Material, color, texture, spine, title label, stickers and stamps on the cover (reusing goal 4), live preview on the closed notebook. *Done when:* a customized cover saves, reloads and shows on the bookshelf.
7. **Colors and customization.** Free color picker for paper, ruling, margin line, text and desk background, plus a few built-in presets. *Done when:* every visual value in a notebook is editable and persists.
8. **Lock and PDF export.** Optional passcode with AES-256-GCM, a warning that a lost passcode is unrecoverable, a lock screen, and export of cover plus all pages with lines, text, stickers and stamps to PDF. *Done when:* a locked file is unreadable without the passcode, and the PDF matches the screen with selectable text.
9. **Stretch: real page curl.** Replace the flat page flip with a three.js curl shader behind the same animation interface, with a fallback to the flat flip. *Done when:* the curl runs smoothly on a 100-page notebook with stickers on both pages.

## Rules for Codex (copy into AGENTS.md)

- Build toward the goals, in order. Do not add features outside this document (no search, tags, sync, AI, photos, user fonts, Linux).
- Before calling a goal done: lint, typecheck and tests pass, and its done-when check has an automated test or screenshot check.
- Use only original, CC0 or open-license art and fonts. Record every asset's source and license in `/packages/assets/LICENSES.md`. Do not scrape or copy copyrighted art.
- No hard-coded visual values. Use the schema and theme tokens.
- Keep OS-specific code behind an interface and list it in the goal notes.
- Keep dependencies minimal and justify any new major one in the notes.
- Take screenshots to check your own visual work, especially line alignment, spread layout and the cover.
- If a requirement here conflicts with what works, choose the simplest option that keeps the notebook feel and write the conflict in the notes. Do not stop to ask.
- End the run with a short report: what works, what is untested, and known issues.

## Your manual test checklist

Run this on an Apple Silicon Mac, an Intel Mac and Windows, then tell Codex what failed.

- [ ] Install from the CI artifact on each machine and launch it.
- [ ] Create a 20-page and a 100-page notebook.
- [ ] Type with every bundled font at every size. Do the letters sit on the lines, with no drift down the page?
- [ ] Fill a page to the end. Does typing stop cleanly?
- [ ] Make headings and bullets. Do they line up with the ruling?
- [ ] Place, resize, rotate and delete stickers. Place a stamp repeatedly. Undo and redo.
- [ ] Open and close the notebook, flip pages, and turn animations off.
- [ ] Shrink the window below the threshold. Does it go to one page without losing content?
- [ ] Customize the cover, then quit and relaunch. Does everything come back?
- [ ] Change every color setting.
- [ ] Lock a notebook, relaunch, unlock, then try a wrong passcode.
- [ ] Export a PDF. Open it and compare it with the screen: cover, lines, text, stickers, stamps.

# Lined Notebook

Lined Notebook is a free, open-source desktop journal that looks and behaves like a physical notebook. It runs locally on your computer: there are no accounts, cloud services, analytics, or AI features.

The app currently targets Windows and macOS. Builds are unsigned, so both operating systems may display a security warning during installation.

## What you can do

- Create notebooks containing 20–100 fixed pages.
- Choose narrow, college, or wide ruling.
- Write with headings, bullet lists, bold, italic, underline, fonts, and colors.
- Decorate pages with built-in stickers, stamps, and locally embedded photos; move and rotate them on the page.
- Draw with a pen or translucent highlighter and erase individual strokes.
- Navigate with page thumbnails, bookmarks, section tabs, and colored dividers.
- Choose notes, checklist, weekly planner, habit tracker, Cornell, music, or sketch page layouts.
- Customize the cover, paper, ruling, margin, text, and desk colors.
- Protect a notebook with AES-256-GCM passcode encryption.
- Export a notebook to PDF.

Notebook files are stored locally in your Documents folder under `Lined Notebooks`. On Windows with OneDrive-managed Documents, this is commonly `C:\Users\<you>\OneDrive\Documents\Lined Notebooks`. The exact active location is displayed above the notebook covers on the shelf. Copy the `.lnb` files somewhere safe to back them up.

> **Important:** An encrypted notebook cannot be recovered if you forget its passcode.

## Installing a released build

This project does not yet publish signed releases. Packaged installers are produced by the GitHub Actions workflow on every push.

1. Open the repository's **Actions** page on GitHub.
2. Select a successful **build** workflow run.
3. Download the artifact for your operating system:
   - `lined-notebook-windows-latest`
   - `lined-notebook-macos-latest`
4. Extract the downloaded ZIP before opening the installer.

### Windows

1. Open the extracted `.exe` installer.
2. If Microsoft Defender SmartScreen says that Windows protected your PC, select **More info**.
3. Confirm that the displayed application is **Lined Notebook**, then select **Run anyway**.
4. Follow the installer prompts and launch Lined Notebook from the Start menu.

The warning appears because the installer is not code-signed. Only bypass it for an installer you downloaded from this project's own GitHub Actions page or built yourself.

To uninstall the app, open **Settings → Apps → Installed apps**, find **Lined Notebook**, and select **Uninstall**. Your `.lnb` notebook files remain in Documents unless you delete them separately.

### macOS

The macOS artifact targets macOS 26 and 27 and is a universal build for both Apple Silicon and Intel Macs. Older macOS releases are intentionally unsupported.

1. Open the extracted `.dmg` file.
2. Drag **Lined Notebook** into the Applications folder.
3. Open Applications in Finder.
4. Control-click **Lined Notebook** and choose **Open**.
5. Choose **Open** again in the security dialog.

If Big Sur blocks the app without offering an Open button, open **System Preferences → Security & Privacy → General**, locate the message about Lined Notebook, and choose **Open Anyway**. On newer macOS versions, use **System Settings → Privacy & Security** instead.

The warning appears because the app is not signed or notarized. Only bypass it for a build downloaded from this project's own GitHub Actions page or built yourself.

To uninstall the app, move **Lined Notebook** from Applications to the Trash. Your `.lnb` notebook files remain in Documents unless you delete them separately.

## Using the app

### Create and open notebooks

1. Select **New notebook** on the shelf.
2. Enter a title, choose the number of pages, ruling, and paper color.
3. Select **Create**.
4. Click the closed notebook to open it.

Saved notebooks automatically appear as cover cards on the shelf, with the most recently updated first. Select a cover to reopen it. Use **Open file** to open an `.lnb` file stored outside the normal library folder.

### Write and navigate

- Click any ruled line on a page and begin typing there.
- Use the formatting bar above the active page for bold, italic, underline, headings, lists, and text color.
- Use the left and right page-edge buttons or the arrow keys to turn pages.
- When the final ruled line is occupied, the page displays **Page full** and stops accepting additional content.
- Narrow windows display one page; wider windows display a two-page spread. The page contents do not change when the layout switches.

### Add decorations

- Select a sticker or stamp from the tray, then click the page where it should be placed.
- Drag a placed decoration to move it.
- Double-click a decoration to delete it.
- Use **Undo** and **Redo** for text and decoration changes.

Hover or focus a placed decoration to reveal its editing controls. Photos selected with **Photo** are embedded directly in the local notebook file.

The decoration controls also resize, reorder, duplicate, lock, and delete items. Photo controls cycle frames and filters, switch between crop and fit, adjust crop focus, and add captions. Keyboard users can focus a decoration, move it with the arrow keys, use Shift for larger steps, and press Delete to remove it.

Use **Pages** for thumbnails, bookmarks, page reordering, duplication, clearing, section tabs, and divider colors. Page count never changes. The page formatting bar selects a page template and provides numbered lists, quotes, dividers, checkboxes, and date headings.

### Customize and lock a notebook

- Select **Cover** to change the material, cover color, spine color, and label.
- Select **Settings** to change paper, line, margin, text, and desk colors; ruling type; font; and animation preference.
- Six bundled open-license typefaces are available, including serif, readable sans, handwriting, connected cursive, and curvy script styles. The page formatting bar applies a font to selected text; Settings changes the notebook default.
- In Settings, enter a passcode of at least four characters and select **Enable encryption** to encrypt the notebook file.

The app autosaves shortly after every change and shows its save state in the title bar. Saves are serialized, verified before replacement, and retain a recovery `.lnb.backup` copy of the previous version. There is no separate Save command.

### Export a PDF

Open the notebook and select **Export PDF** in the top toolbar. Choose a filename and location when prompted. The PDF contains the front cover, every notebook page, and the back cover.
The export dialog can limit the page range, omit covers, and choose A4 or US Letter. Settings can save a validated portable `.lnb` backup copy. The shelf’s Recovery Center can restore the previous verified autosave.

## Build and run from source

### Requirements

- Node.js 22 or newer
- npm 10 or newer
- Git
- Windows 10/11 or macOS 26/27

Clone the repository, install dependencies, and start the development build:

```sh
git clone <repository-url>
cd "Digital Journal"
npm install
npm run dev
```

Useful commands:

```sh
npm run check       # lint, type-check, and unit tests
npm run test:e2e    # Playwright UI and screenshot tests
npm run build       # production application build
npm run dist        # create the installer for the current operating system
```

The first UI test run may require installing the Playwright browser:

```sh
npx playwright install chromium
```

Packaging must be run on the target operating system. Run `npm run dist` on Windows to produce an NSIS installer, or on macOS to produce the universal DMG. Output is written to `release/`.

The app uses the maintained Electron 42 line and intentionally sets a macOS 26 deployment minimum. Windows packaging is labeled for Windows 10/11; Linux packaging is not supported.

## Privacy and data

- The app does not need an internet connection after installation.
- Notebook content is never uploaded by the app.
- Unlocked notebook packages are local structured data, not encrypted data.
- Passcode-protected packages are encrypted using AES-256-GCM with a key derived using scrypt.
- Backups are your responsibility. Copy your `.lnb` files to your normal backup destination.

## Current status

This is an early implementation. See [GOALS.md](GOALS.md) for implemented features, test coverage, and known gaps. See [Lined Notebook App Codex Hand-off.md](Lined%20Notebook%20App%20Codex%20Hand-off.md) for the complete product plan.

## License

The application is intended to be free and open source. A repository-level license file still needs to be added before redistribution. Asset licensing notes are recorded in [packages/assets/LICENSES.md](packages/assets/LICENSES.md).

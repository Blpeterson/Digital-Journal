import { useCallback, useEffect, useRef, useState } from 'react'
import { FONT_PROFILES, PAGE_SIZE, RULING_HEIGHTS, type Notebook, type NotebookSummary, type PhotoInstance, type StampInstance, type StickerInstance } from '@schema'
import { useNotebook } from './store'
import { NotebookPage } from './editor/NotebookPage'

export const GLYPHS: Record<string, string> = {
  flower: '✿', star: '★', heart: '♥', leaf: '❧', butterfly: '❦', moon: '☾', sun: '☀', music: '♫',
  approved: 'APPROVED', date: 'TODAY', spark: '✦', important: 'IMPORTANT', done: 'DONE', idea: 'IDEA', smile: '☺',
}

function playPageTurnSound() {
  const context = new AudioContext()
  const duration = .14
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length)
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain()
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1150; gain.gain.value = .035
  source.connect(filter).connect(gain).connect(context.destination); source.start(); source.onended = () => void context.close()
}

function useSinglePage() {
  const [single, setSingle] = useState(() => matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const query = matchMedia('(max-width: 900px)')
    const update = () => setSingle(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return single
}

export function App() {
  const state = useNotebook()
  const singlePage = useSinglePage()
  const [creating, setCreating] = useState(false)
  const [settings, setSettings] = useState(false)
  const [cover, setCover] = useState(false)
  const [navigator, setNavigator] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [presentation, setPresentation] = useState(false)
  const [viewSettings, setViewSettings] = useState(false)
  const [lockedPath, setLockedPath] = useState<string>()
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const notebookId = state.notebook?.id
  const turnPages = state.turn

  useEffect(() => {
    if (!state.notebook) return
    clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => window.notebookAPI.save(state.notebook!, state.passcode).then(() => setSaveState('saved')).catch((reason: Error) => { setSaveState('error'); setError(reason.message) }), 500)
    return () => clearTimeout(saveTimer.current)
  }, [state.notebook, state.passcode])

  useEffect(() => {
    if (notebookId) turnPages(0, singlePage)
  }, [singlePage, notebookId, turnPages])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editing = Boolean(target.closest('input,textarea,select,button,[contenteditable="true"]'))
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !editing) { event.preventDefault(); if (event.shiftKey) state.redo(); else state.undo(); return }
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key) && !editing) { event.preventDefault(); useNotebook.setState({ zoom: Math.max(.8, Math.min(1.4, state.zoom + (event.key === '-' ? -.1 : .1))) }); return }
      if (event.key === 'Escape' && presentation) { setPresentation(false); if (document.fullscreenElement) void document.exitFullscreen(); return }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); if (state.sounds) playPageTurnSound(); state.turn(-1, singlePage) }
      if (event.key === 'ArrowRight') { event.preventDefault(); if (state.sounds) playPageTurnSound(); state.turn(1, singlePage) }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [singlePage, state, presentation])

  async function openPath(path: string) {
    try { state.setNotebook(await window.notebookAPI.load(path)) }
    catch (reason) {
      if ((reason as Error).message.includes('PASSCODE_REQUIRED')) setLockedPath(path)
      else setError((reason as Error).message)
    }
  }

  async function openDialog() {
    const result = await window.notebookAPI.openDialog()
    if (!result.canceled) await openPath(result.filePaths[0])
  }

  async function goToShelf() {
    clearTimeout(saveTimer.current)
    if (state.notebook) {
      try { await window.notebookAPI.save(state.notebook, state.passcode) }
      catch (reason) { setError((reason as Error).message); return }
    }
    useNotebook.setState({ notebook: null, open: false, pageIndex: 0, passcode: undefined, placementTool: null })
  }

  if (lockedPath) return <Unlock path={lockedPath} cancel={() => setLockedPath(undefined)} />
  if (!state.notebook) return <Library creating={creating} setCreating={setCreating} openPath={openPath} openDialog={openDialog} />

  const notebook = state.notebook
  const maxIndex = singlePage ? notebook.pageCount - 1 : Math.max(0, notebook.pageCount - 2)
  const previousDisabled = state.pageIndex === 0
  const nextDisabled = state.pageIndex >= maxIndex
  const turn = (direction: number) => { if (state.sounds) playPageTurnSound(); state.turn(direction, singlePage) }

  return <main className={`desk ${state.open ? 'is-open' : ''} ${presentation ? 'presentation' : ''} ${state.highContrast ? 'high-contrast' : ''}`} style={{ '--desk': notebook.style.deskBackground } as React.CSSProperties}>
    <header className="appbar no-print">
      <button className="ghost" onClick={goToShelf}>Shelf</button>
      <strong>{notebook.title} <small className={`save-status ${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save failed'}</small></strong>
      <nav aria-label="Notebook actions">
        <button className="ghost" onClick={state.undo}>Undo</button>
        <button className="ghost" onClick={state.redo}>Redo</button>
        <button className="ghost" onClick={() => setNavigator(value => !value)}>Pages</button>
        <button className={`ghost ${notebook.pages[state.pageIndex].bookmarked ? 'bookmarked' : ''}`} onClick={() => state.updatePage(state.pageIndex, { bookmarked: !notebook.pages[state.pageIndex].bookmarked })}>{notebook.pages[state.pageIndex].bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
        <button className="ghost" onClick={() => setCover(true)}>Cover</button>
        <button className="ghost" onClick={() => setSettings(true)}>Settings</button>
        <button className="ghost" onClick={() => setViewSettings(true)}>View</button>
        <button className="ghost" onClick={async () => { setPresentation(true); try { await document.documentElement.requestFullscreen() } catch { /* Windowed presentation remains available. */ } }}>Present</button>
        <button className="ghost" onClick={() => setExporting(true)}>Export PDF</button>
      </nav>
    </header>
    {error && <div className="toast">{error}<button onClick={() => setError('')}>×</button></div>}
    {!state.open ? <ClosedNotebook notebook={notebook} open={() => useNotebook.setState({ open: true })} /> : <>
      <Toolbar />
      <div className={`book ${state.animations ? 'animate' : ''} turn-${state.turnDirection}`} style={{ zoom: state.zoom }}>
        <button data-testid="page-turn-previous" aria-label={singlePage ? 'Previous page' : 'Previous pages'} className="page-edge no-print" disabled={previousDisabled} onClick={() => turn(-1)}>‹</button>
        <div className="spread">
          <NotebookPage key={state.pageIndex} pageIndex={state.pageIndex} />
          {!singlePage && state.pageIndex + 1 < notebook.pageCount && <NotebookPage key={state.pageIndex + 1} pageIndex={state.pageIndex + 1} right />}
        </div>
        <button data-testid="page-turn-next" aria-label={singlePage ? 'Next page' : 'Next pages'} className="page-edge no-print" disabled={nextDisabled} onClick={() => turn(1)}>›</button>
      </div>
      <footer className="page-counter no-print">{singlePage ? `Page ${state.pageIndex + 1}` : `Pages ${state.pageIndex + 1}–${Math.min(state.pageIndex + 2, notebook.pageCount)}`} of {notebook.pageCount} · <button className="link" onClick={() => useNotebook.setState({ open: false })}>close</button></footer>
    </>}
    {settings && <Settings close={() => setSettings(false)} />}
    {cover && <Cover close={() => setCover(false)} />}
    {navigator && <PageNavigator notebook={notebook} current={state.pageIndex} singlePage={singlePage} close={() => setNavigator(false)} />}
    {exporting && <ExportDialog notebook={notebook} close={() => setExporting(false)} fail={setError} />}
    {presentation && <button className="presentation-exit no-print" onClick={() => { setPresentation(false); if (document.fullscreenElement) void document.exitFullscreen() }}>Exit presentation</button>}
    {viewSettings && <ViewOptions close={() => setViewSettings(false)} />}
  </main>
}

function ViewOptions({ close }: { close(): void }) {
  const state = useNotebook()
  return <div className="scrim"><section className="panel view-panel"><button className="close" onClick={close}>×</button><h2>View and sound</h2><label className="inline"><input type="checkbox" checked={state.highContrast} onChange={event => useNotebook.setState({ highContrast: event.target.checked })}/> High contrast</label><label className="inline"><input type="checkbox" checked={state.sounds} onChange={event => useNotebook.setState({ sounds: event.target.checked })}/> Page-turn sound</label><label>Page zoom <output>{Math.round(state.zoom * 100)}%</output><input type="range" min="80" max="140" step="10" value={state.zoom * 100} onChange={event => useNotebook.setState({ zoom: +event.target.value / 100 })}/></label><p>Keyboard: Ctrl/⌘ and + or − changes zoom. Arrow keys turn pages.</p></section></div>
}

function ExportDialog({ notebook, close, fail }: { notebook: Notebook; close(): void; fail(message: string): void }) {
  const [from, setFrom] = useState(1), [to, setTo] = useState(notebook.pageCount)
  const [includeCovers, setIncludeCovers] = useState(true)
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4')
  const [busy, setBusy] = useState(false)
  return <div className="scrim"><form className="panel export-panel" onSubmit={async event => { event.preventDefault(); setBusy(true); try { await window.notebookAPI.exportPdf(notebook.title, notebook, { from, to, includeCovers, paperSize }); close() } catch (reason) { fail((reason as Error).message); setBusy(false) } }}><button type="button" className="close" onClick={close}>×</button><h2>Export PDF</h2><p>Choose exactly what the printable copy should contain.</p><div className="range-grid"><label>First page<input type="number" min="1" max={notebook.pageCount} value={from} onChange={event => setFrom(Math.min(+event.target.value, to))}/></label><label>Last page<input type="number" min={from} max={notebook.pageCount} value={to} onChange={event => setTo(+event.target.value)}/></label></div><label>Paper size<select value={paperSize} onChange={event => setPaperSize(event.target.value as 'A4' | 'Letter')}><option value="A4">A4</option><option value="Letter">US Letter</option></select></label><label className="inline"><input type="checkbox" checked={includeCovers} onChange={event => setIncludeCovers(event.target.checked)}/> Include front and back covers</label><p className="export-summary">{(includeCovers ? 2 : 0) + (to - from + 1)} sheets · Pages {from}–{to}</p><div className="panel-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button disabled={busy}>{busy ? 'Creating PDF…' : 'Choose destination'}</button></div></form></div>
}

function contentText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: string; content?: unknown[] }
  return `${node.text ?? ''} ${(node.content ?? []).map(contentText).join(' ')}`.trim()
}

function PageNavigator({ notebook, current, singlePage, close }: { notebook: Notebook; current: number; singlePage: boolean; close(): void }) {
  const bookmarked = notebook.pages.filter(page => page.bookmarked)
  const state = useNotebook()
  return <aside className="page-navigator no-print" aria-label="Page navigator"><header><div><strong>Pages</strong><small>{bookmarked.length} bookmarked</small></div><button onClick={close}>×</button></header><div className="page-management"><button disabled={current === 0} onClick={() => state.movePage(current, -1)}>← Move</button><button disabled={current === notebook.pageCount - 1} onClick={() => state.movePage(current, 1)}>Move →</button><button onClick={() => state.duplicatePage(current)}>Duplicate</button><button onClick={() => { if (confirm(`Clear page ${current + 1}? This can be undone.`)) state.clearPage(current) }}>Clear</button><button onClick={() => { const label = prompt('Section tab label', notebook.pages[current].tabLabel ?? ''); if (label !== null) state.updatePage(current, { tabLabel: label.trim() || undefined }) }}>{notebook.pages[current].tabLabel ? 'Edit tab' : 'Add tab'}</button><label className="divider-control">Divider <input aria-label="Divider color" type="color" value={notebook.pages[current].dividerColor ?? '#d7a85c'} onChange={event => state.updatePage(current, { dividerColor: event.target.value })}/><button onClick={() => state.updatePage(current, { dividerColor: undefined })}>×</button></label></div>{bookmarked.length > 0 && <nav className="bookmark-strip" aria-label="Bookmarks">{bookmarked.map(page => <button key={page.index} onClick={() => { useNotebook.setState({ pageIndex: singlePage ? page.index : page.index - page.index % 2 }); close() }}>★ {page.index + 1}</button>)}</nav>}<div className="page-thumbnails">{notebook.pages.map(page => <button className={`page-thumbnail ${page.index === current ? 'current' : ''}`} key={page.index} onClick={() => { useNotebook.setState({ pageIndex: singlePage ? page.index : page.index - page.index % 2 }) }}><span className="thumbnail-paper" style={{ borderTop: page.dividerColor ? `6px solid ${page.dividerColor}` : undefined }}><i>{page.tabLabel ? `${page.tabLabel} · ` : ''}{contentText(page.content).slice(0, 70) || 'Blank page'}</i>{page.bookmarked && <b>★</b>}</span><small>Page {page.index + 1}</small></button>)}</div></aside>
}

function Library({ creating, setCreating, openPath, openDialog }: { creating: boolean; setCreating(value: boolean): void; openPath(path: string): Promise<void>; openDialog(): Promise<void> }) {
  const [library, setLibrary] = useState<{ directory: string; notebooks: NotebookSummary[] }>({ directory: 'Documents/Lined Notebooks', notebooks: [] })
  const [recoveries, setRecoveries] = useState<Array<{ id: string; title: string; modifiedAt: string; encrypted: boolean }>>([])
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { const [nextLibrary, nextRecoveries] = await Promise.all([window.notebookAPI.list(), window.notebookAPI.listRecoveries()]); setLibrary(nextLibrary); setRecoveries(nextRecoveries) }, [])
  useEffect(() => { void refresh().finally(() => setLoading(false)) }, [refresh])
  return <main className="desk library" data-testid="shelf">
    <header className="shelf-header"><div className="shelf-brand"><div className="brand-mark small">N</div><div><h1>Lined Notebook</h1><p>Your private, local notebook shelf</p></div></div><div className="actions"><button onClick={() => setCreating(true)}>New notebook</button><button className="secondary" onClick={openDialog}>Open file</button><button className="secondary" onClick={() => setShowRecovery(true)}>Recovery {recoveries.length ? `(${recoveries.length})` : ''}</button></div></header>
    <section className="shelf-content">
      <div className="shelf-title"><div><h2>Your notebooks</h2><p>{loading ? 'Looking on your shelf…' : `${library.notebooks.length} saved locally`}</p></div><code title={library.directory}>{library.directory}</code></div>
      <div className="notebook-rail">
        <button className="new-notebook-card" onClick={() => setCreating(true)}><span>＋</span><strong>New notebook</strong></button>
        {library.notebooks.map(summary => <ShelfCard key={summary.path} summary={summary} open={() => openPath(summary.path)} />)}
        {!loading && library.notebooks.length === 0 && <div className="empty-shelf"><strong>Your shelf is empty.</strong><span>Create your first notebook to see its cover here.</span></div>}
      </div>
    </section>
    {creating && <NewNotebook close={() => setCreating(false)} />}
    {showRecovery && <div className="scrim"><section className="panel wide recovery-panel"><button className="close" onClick={() => setShowRecovery(false)}>×</button><h2>Recovery center</h2><p>Each completed save keeps the previous verified notebook version. Restoring also preserves the current file.</p>{recoveryMessage && <p className="recovery-message">{recoveryMessage}</p>}<div className="recovery-list">{recoveries.map(item => <div className="recovery-row" key={item.id}><div><strong>{item.title}</strong><small>{new Date(item.modifiedAt).toLocaleString()}{item.encrypted ? ' · Passcode protected' : ''}</small></div><button onClick={async () => { try { await window.notebookAPI.restoreRecovery(item.id); await refresh(); setRecoveryMessage(`Restored ${item.title}.`) } catch (reason) { setRecoveryMessage((reason as Error).message) } }}>Restore</button></div>)}{!recoveries.length && <p>No recovery copies are available yet.</p>}</div></section></div>}
  </main>
}

function ShelfCard({ summary, open }: { summary: NotebookSummary; open(): void }) {
  const cover = summary.cover
  return <button data-testid="notebook-card" data-notebook-id={summary.id} aria-label={`Open ${summary.title}`} className={`shelf-card material-${cover?.material ?? 'cloth'}`} style={{ '--cover': cover?.color ?? '#4d4b50', '--spine': cover?.spineColor ?? '#2b2930' } as React.CSSProperties} onClick={open}>
    <span className="spine" />
    {cover && <CoverArt cover={cover} />}
    <span className="shelf-card-label" style={{ color: cover?.label.color, fontFamily: cover ? FONT_PROFILES[cover.label.font as keyof typeof FONT_PROFILES]?.family : undefined }}>{summary.encrypted ? '⌾ Locked' : cover?.label.text || summary.title}</span>
    <span className="shelf-card-meta">{summary.pageCount ? `${summary.pageCount} pages` : 'Passcode required'}</span>
  </button>
}

function NewNotebook({ close }: { close(): void }) {
  const create = useNotebook(state => state.createNew)
  const [title, setTitle] = useState('My Notebook')
  const [count, setCount] = useState(40)
  const [ruling, setRuling] = useState<number>(RULING_HEIGHTS.college)
  const [paper, setPaper] = useState('#fffdf5')
  return <div className="scrim"><form className="panel" onSubmit={event => { event.preventDefault(); create(title, count, ruling, paper); close() }}><h2>Choose your notebook</h2><label>Title<input value={title} onChange={event => setTitle(event.target.value)} required /></label><label>Pages <output>{count}</output><input type="range" min="20" max="100" step="2" value={count} onChange={event => setCount(+event.target.value)} /></label><label>Ruling<select value={ruling} onChange={event => setRuling(+event.target.value)}><option value={RULING_HEIGHTS.narrow}>Narrow</option><option value={RULING_HEIGHTS.college}>College</option><option value={RULING_HEIGHTS.wide}>Wide</option></select></label><label>Paper<input type="color" value={paper} onChange={event => setPaper(event.target.value)} /></label><div className="panel-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button>Create</button></div></form></div>
}

function ClosedNotebook({ notebook, open }: { notebook: Notebook; open(): void }) {
  return <button className={`closed-notebook material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties} onClick={open}><span className="spine" /><CoverArt cover={notebook.cover} /><span className="cover-label" style={{ color: notebook.cover.label.color, fontFamily: FONT_PROFILES[notebook.cover.label.font as keyof typeof FONT_PROFILES]?.family }}>{notebook.cover.label.text}</span><span className="open-hint">Click to open</span></button>
}

function CoverArt({ cover }: { cover: Notebook['cover'] }) {
  return <span className="cover-art">{[...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].map(item => <span key={item.id} className={'dataUrl' in item ? 'cover-art-item photo' : 'inkColor' in item ? 'cover-art-item stamp' : 'cover-art-item'} style={{ left: `${item.x / PAGE_SIZE.width * 100}%`, top: `${item.y / PAGE_SIZE.height * 100}%`, transform: `translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`, zIndex: item.z, color: 'inkColor' in item ? item.inkColor : undefined }}>{'dataUrl' in item ? <img src={item.dataUrl} alt=""/> : GLYPHS[item.assetId]}</span>)}</span>
}

function Toolbar() {
  const state = useNotebook()
  const choose = (assetId: string, kind: 'sticker' | 'stamp') => state.selectPlacement(state.placementTool?.assetId === assetId ? null : { assetId, kind })
  async function addPhoto() {
    try {
      const photo = await window.notebookAPI.choosePhoto()
      if (!photo) return
      state.addPhoto(state.pageIndex, { id: crypto.randomUUID(), ...photo, x: 360, y: 480, rotation: 0, scale: 1, z: Date.now(), locked: false, frame: 'plain', filter: 'none', fit: 'crop', cropX: 50, cropY: 50 })
    } catch (reason) { alert((reason as Error).message) }
  }
  return <aside className="toolbar no-print"><span>{state.placementTool ? 'Click a page to place' : state.drawingTool ? 'Draw on the page' : 'Stickers'}</span>{['flower', 'star', 'heart', 'leaf', 'butterfly', 'moon', 'sun', 'music'].map(asset => <button aria-label={asset} className={state.placementTool?.assetId === asset ? 'active' : ''} key={asset} onClick={() => { state.selectDrawing(null); choose(asset, 'sticker') }}>{GLYPHS[asset]}</button>)}<i /><span>Stamps</span>{['approved', 'date', 'spark', 'important', 'done', 'idea', 'smile'].map(asset => <button aria-label={asset} className={`stamp-button ${state.placementTool?.assetId === asset ? 'active' : ''}`} key={asset} onClick={() => { state.selectDrawing(null); choose(asset, 'stamp') }}>{GLYPHS[asset]}</button>)}<i /><button className="photo-button" onClick={addPhoto}>＋ Photo</button><button className={state.drawingTool === 'pen' ? 'active' : ''} onClick={() => state.selectDrawing(state.drawingTool === 'pen' ? null : 'pen')}>✎ Pen</button><button className={state.drawingTool === 'highlighter' ? 'active' : ''} onClick={() => state.selectDrawing(state.drawingTool === 'highlighter' ? null : 'highlighter')}>▰ Highlight</button><button className={state.drawingTool === 'eraser' ? 'active' : ''} onClick={() => state.selectDrawing(state.drawingTool === 'eraser' ? null : 'eraser')}>⌫ Erase</button>{(state.placementTool || state.drawingTool) && <button onClick={() => { state.selectPlacement(null); state.selectDrawing(null) }}>Cancel</button>}</aside>
}

function Settings({ close }: { close(): void }) {
  const state = useNotebook(), notebook = state.notebook!
  const [passcode, setPasscode] = useState('')
  const colors: [keyof typeof notebook.style, string][] = [['paperColor', 'Paper'], ['rulingColor', 'Lines'], ['marginLine', 'Margin'], ['defaultTextColor', 'Text'], ['deskBackground', 'Desk']]
  return <div className="scrim"><section className="panel wide"><button className="close" onClick={close}>×</button><h2>Notebook settings</h2><div className="color-grid">{colors.map(([key, label]) => <label key={key}>{label}<input type="color" value={String(notebook.style[key])} onChange={event => state.updateStyle({ [key]: event.target.value })} /></label>)}</div><label>Ruling<select value={notebook.style.ruling} onChange={event => state.updateStyle({ ruling: event.target.value as typeof notebook.style.ruling })}><option value="lined">Lined</option><option value="dotted">Dotted</option><option value="grid">Grid</option><option value="blank">Blank</option></select></label><label>Paper texture<select value={notebook.style.paperTexture ?? 'clean'} onChange={event => state.updateStyle({ paperTexture: event.target.value as typeof notebook.style.paperTexture })}><option value="clean">Clean</option><option value="fiber">Natural fiber</option><option value="parchment">Warm parchment</option><option value="speckled">Speckled</option></select></label><label>Default font<select value={notebook.style.defaultFont} onChange={event => state.updateStyle({ defaultFont: event.target.value })}>{Object.keys(FONT_PROFILES).map(font => <option key={font}>{font}</option>)}</select></label><label className="inline"><input type="checkbox" checked={state.animations} onChange={event => useNotebook.setState({ animations: event.target.checked })} /> Page animations</label><button onClick={() => void window.notebookAPI.backupCopy(notebook, state.passcode)}>Save portable backup copy…</button><hr /><h3>Passcode lock</h3><p className="warning">A forgotten passcode cannot be recovered.</p><input type="password" placeholder="New passcode" value={passcode} onChange={event => setPasscode(event.target.value)} /><button disabled={passcode.length < 4} onClick={() => { useNotebook.setState({ passcode }); setPasscode('') }}>Enable encryption</button></section></div>
}

function Cover({ close }: { close(): void }) {
  const state = useNotebook(), cover = state.notebook!.cover
  const [tool, setTool] = useState<{ kind: 'sticker' | 'stamp'; assetId: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  function updateItem(id: string, patch: Partial<StickerInstance | StampInstance | PhotoInstance>) {
    state.updateCover({ stickers: cover.stickers.map(item => item.id === id ? { ...item, ...patch } : item), stamps: cover.stamps.map(item => item.id === id ? { ...item, ...patch } : item), photos: (cover.photos ?? []).map(item => item.id === id ? { ...item, ...patch } as PhotoInstance : item) })
  }
  function removeItem(id: string) { state.updateCover({ stickers: cover.stickers.filter(item => item.id !== id), stamps: cover.stamps.filter(item => item.id !== id), photos: (cover.photos ?? []).filter(item => item.id !== id) }); setSelected(null) }
  async function addCoverPhoto() { const photo = await window.notebookAPI.choosePhoto(); if (photo) state.updateCover({ photos: [...(cover.photos ?? []), { id: crypto.randomUUID(), ...photo, x: 360, y: 480, rotation: 0, scale: 1, z: Date.now(), locked: false, frame: 'polaroid', filter: 'none', fit: 'crop', cropX: 50, cropY: 50 }] }) }
  return <div className="scrim"><section className="panel cover-panel"><button className="close" onClick={close}>×</button><div className="cover-editor-grid"><div className="cover-options"><h2>Design the cover</h2><label>Material<select value={cover.material} onChange={event => state.updateCover({ material: event.target.value as typeof cover.material })}><option>cloth</option><option>leather</option><option>paper</option></select></label><label>Cover<input type="color" value={cover.color} onChange={event => state.updateCover({ color: event.target.value })} /></label><label>Spine<input type="color" value={cover.spineColor} onChange={event => state.updateCover({ spineColor: event.target.value })} /></label><label>Label<input value={cover.label.text} onChange={event => state.updateCover({ label: { ...cover.label, text: event.target.value } })} /></label><label>Label font<select value={cover.label.font} onChange={event => state.updateCover({ label: { ...cover.label, font: event.target.value } })}>{Object.keys(FONT_PROFILES).map(font => <option key={font}>{font}</option>)}</select></label><div className="cover-asset-tray">{['flower', 'star', 'heart', 'leaf'].map(asset => <button key={asset} onClick={() => setTool({ kind: 'sticker', assetId: asset })}>{GLYPHS[asset]}</button>)}{['approved', 'date', 'spark'].map(asset => <button className="stamp-button" key={asset} onClick={() => setTool({ kind: 'stamp', assetId: asset })}>{GLYPHS[asset]}</button>)}<button onClick={() => void addCoverPhoto()}>＋ Photo</button></div>{selected && <div className="cover-selection-tools"><button onClick={() => { const item = [...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].find(entry => entry.id === selected); if (item) updateItem(selected, { rotation: item.rotation - 15 }) }}>↶</button><button onClick={() => { const item = [...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].find(entry => entry.id === selected); if (item) updateItem(selected, { rotation: item.rotation + 15 }) }}>↷</button><button onClick={() => { const item = [...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].find(entry => entry.id === selected); if (item) updateItem(selected, { scale: Math.max(.35, item.scale - .15) }) }}>−</button><button onClick={() => { const item = [...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].find(entry => entry.id === selected); if (item) updateItem(selected, { scale: Math.min(3, item.scale + .15) }) }}>＋</button><button onClick={() => removeItem(selected)}>Delete</button></div>}</div><div className={`cover-canvas material-${cover.material} ${tool ? 'placing' : ''}`} style={{ '--cover': cover.color, '--spine': cover.spineColor } as React.CSSProperties} onClick={event => { if (!tool || (event.target as HTMLElement).closest('.cover-decoration')) return; const rect = event.currentTarget.getBoundingClientRect(); const base = { id: crypto.randomUUID(), assetId: tool.assetId, x: (event.clientX - rect.left) / rect.width * PAGE_SIZE.width, y: (event.clientY - rect.top) / rect.height * PAGE_SIZE.height, rotation: 0, scale: 1, z: Date.now(), locked: false }; if (tool.kind === 'stamp') state.updateCover({ stamps: [...cover.stamps, { ...base, inkColor: '#9e3434', seed: Math.random() }] }); else state.updateCover({ stickers: [...cover.stickers, base] }); setTool(null) }}><span className="spine"/><span className="cover-label" style={{ color: cover.label.color, fontFamily: FONT_PROFILES[cover.label.font as keyof typeof FONT_PROFILES]?.family }}>{cover.label.text}</span>{[...cover.stickers, ...cover.stamps, ...(cover.photos ?? [])].map(item => <button key={item.id} className={`cover-decoration ${'dataUrl' in item ? 'photo' : 'inkColor' in item ? 'stamp' : 'sticker'} ${selected === item.id ? 'selected' : ''}`} style={{ left: `${item.x / PAGE_SIZE.width * 100}%`, top: `${item.y / PAGE_SIZE.height * 100}%`, transform: `translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`, zIndex: item.z, color: 'inkColor' in item ? item.inkColor : undefined }} onClick={event => { event.stopPropagation(); setSelected(item.id) }}>{'dataUrl' in item ? <img src={item.dataUrl} alt={item.name}/> : GLYPHS[item.assetId]}</button>)}</div></div></section></div>
}

function Unlock({ path, cancel }: { path: string; cancel(): void }) {
  const [passcode, setPasscode] = useState(''), [error, setError] = useState(''), setNotebook = useNotebook(state => state.setNotebook)
  return <main className="desk"><form className="panel lock-panel" onSubmit={async event => { event.preventDefault(); try { setNotebook(await window.notebookAPI.load(path, passcode), passcode) } catch { setError('That passcode did not unlock this notebook.') } }}><div className="lock-icon">⌾</div><h2>Notebook locked</h2><input autoFocus type="password" value={passcode} onChange={event => setPasscode(event.target.value)} placeholder="Passcode" />{error && <p className="error">{error}</p>}<button>Unlock</button><button type="button" className="secondary" onClick={cancel}>Cancel</button></form></main>
}

export function PrintApp() {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof window.notebookAPI.printNotebook>>>(null)
  useEffect(() => { void window.notebookAPI.printNotebook().then(value => { if (value) { useNotebook.getState().setNotebook(value.notebook); setPayload(value) } }) }, [])
  if (!payload) return <main className="print-loading">Preparing notebook…</main>
  const { notebook, options } = payload
  return <main className={`print-document paper-${options.paperSize.toLowerCase()}`}>
    {options.includeCovers && <section className={`print-cover front material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties}><span className="print-spine"/><CoverArt cover={notebook.cover}/><span className="cover-label" style={{ color: notebook.cover.label.color }}>{notebook.cover.label.text}</span></section>}
    {notebook.pages.slice(options.from - 1, options.to).map(page => <NotebookPage key={page.index} pageIndex={page.index} print />)}
    {options.includeCovers && <section className={`print-cover back material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties}><span className="print-spine"/></section>}
  </main>
}

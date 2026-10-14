import { useEffect, useRef, useState } from 'react'
import { FONT_PROFILES, RULING_HEIGHTS, type Notebook, type NotebookSummary } from '@schema'
import { useNotebook } from './store'
import { NotebookPage } from './editor/NotebookPage'

export const GLYPHS: Record<string, string> = {
  flower: '✿', star: '★', heart: '♥', leaf: '❧', butterfly: '❦', moon: '☾', sun: '☀', music: '♫',
  approved: 'APPROVED', date: 'TODAY', spark: '✦', important: 'IMPORTANT', done: 'DONE', idea: 'IDEA', smile: '☺',
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
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); state.turn(-1, singlePage) }
      if (event.key === 'ArrowRight') { event.preventDefault(); state.turn(1, singlePage) }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [singlePage, state])

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

  return <main className={`desk ${state.open ? 'is-open' : ''}`} style={{ '--desk': notebook.style.deskBackground } as React.CSSProperties}>
    <header className="appbar no-print">
      <button className="ghost" onClick={goToShelf}>Shelf</button>
      <strong>{notebook.title} <small className={`save-status ${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save failed'}</small></strong>
      <nav>
        <button className="ghost" onClick={state.undo}>Undo</button>
        <button className="ghost" onClick={state.redo}>Redo</button>
        <button className="ghost" onClick={() => setCover(true)}>Cover</button>
        <button className="ghost" onClick={() => setSettings(true)}>Settings</button>
        <button className="ghost" onClick={async () => { try { await window.notebookAPI.exportPdf(notebook.title, notebook) } catch (reason) { setError((reason as Error).message) } }}>Export PDF</button>
      </nav>
    </header>
    {error && <div className="toast">{error}<button onClick={() => setError('')}>×</button></div>}
    {!state.open ? <ClosedNotebook notebook={notebook} open={() => useNotebook.setState({ open: true })} /> : <>
      <Toolbar />
      <div className={`book ${state.animations ? 'animate' : ''} turn-${state.turnDirection}`}>
        <button data-testid="page-turn-previous" aria-label={singlePage ? 'Previous page' : 'Previous pages'} className="page-edge no-print" disabled={previousDisabled} onClick={() => state.turn(-1, singlePage)}>‹</button>
        <div className="spread">
          <NotebookPage key={state.pageIndex} pageIndex={state.pageIndex} />
          {!singlePage && state.pageIndex + 1 < notebook.pageCount && <NotebookPage key={state.pageIndex + 1} pageIndex={state.pageIndex + 1} right />}
        </div>
        <button data-testid="page-turn-next" aria-label={singlePage ? 'Next page' : 'Next pages'} className="page-edge no-print" disabled={nextDisabled} onClick={() => state.turn(1, singlePage)}>›</button>
      </div>
      <footer className="page-counter no-print">{singlePage ? `Page ${state.pageIndex + 1}` : `Pages ${state.pageIndex + 1}–${Math.min(state.pageIndex + 2, notebook.pageCount)}`} of {notebook.pageCount} · <button className="link" onClick={() => useNotebook.setState({ open: false })}>close</button></footer>
    </>}
    {settings && <Settings close={() => setSettings(false)} />}
    {cover && <Cover close={() => setCover(false)} />}
  </main>
}

function Library({ creating, setCreating, openPath, openDialog }: { creating: boolean; setCreating(value: boolean): void; openPath(path: string): Promise<void>; openDialog(): Promise<void> }) {
  const [library, setLibrary] = useState<{ directory: string; notebooks: NotebookSummary[] }>({ directory: 'Documents/Lined Notebooks', notebooks: [] })
  const [loading, setLoading] = useState(true)
  useEffect(() => { window.notebookAPI.list().then(setLibrary).finally(() => setLoading(false)) }, [])
  return <main className="desk library" data-testid="shelf">
    <header className="shelf-header"><div className="shelf-brand"><div className="brand-mark small">N</div><div><h1>Lined Notebook</h1><p>Your private, local notebook shelf</p></div></div><div className="actions"><button onClick={() => setCreating(true)}>New notebook</button><button className="secondary" onClick={openDialog}>Open file</button></div></header>
    <section className="shelf-content">
      <div className="shelf-title"><div><h2>Your notebooks</h2><p>{loading ? 'Looking on your shelf…' : `${library.notebooks.length} saved locally`}</p></div><code title={library.directory}>{library.directory}</code></div>
      <div className="notebook-rail">
        <button className="new-notebook-card" onClick={() => setCreating(true)}><span>＋</span><strong>New notebook</strong></button>
        {library.notebooks.map(summary => <ShelfCard key={summary.path} summary={summary} open={() => openPath(summary.path)} />)}
        {!loading && library.notebooks.length === 0 && <div className="empty-shelf"><strong>Your shelf is empty.</strong><span>Create your first notebook to see its cover here.</span></div>}
      </div>
    </section>
    {creating && <NewNotebook close={() => setCreating(false)} />}
  </main>
}

function ShelfCard({ summary, open }: { summary: NotebookSummary; open(): void }) {
  const cover = summary.cover
  return <button data-testid="notebook-card" data-notebook-id={summary.id} aria-label={`Open ${summary.title}`} className={`shelf-card material-${cover?.material ?? 'cloth'}`} style={{ '--cover': cover?.color ?? '#4d4b50', '--spine': cover?.spineColor ?? '#2b2930' } as React.CSSProperties} onClick={open}>
    <span className="spine" />
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
  return <button className={`closed-notebook material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties} onClick={open}><span className="spine" /><span className="cover-label" style={{ color: notebook.cover.label.color, fontFamily: FONT_PROFILES[notebook.cover.label.font as keyof typeof FONT_PROFILES]?.family }}>{notebook.cover.label.text}</span><span className="open-hint">Click to open</span></button>
}

function Toolbar() {
  const state = useNotebook()
  const choose = (assetId: string, kind: 'sticker' | 'stamp') => state.selectPlacement(state.placementTool?.assetId === assetId ? null : { assetId, kind })
  async function addPhoto() {
    try {
      const photo = await window.notebookAPI.choosePhoto()
      if (!photo) return
      state.addPhoto(state.pageIndex, { id: crypto.randomUUID(), ...photo, x: 360, y: 480, rotation: 0, scale: 1, z: Date.now() })
    } catch (reason) { alert((reason as Error).message) }
  }
  return <aside className="toolbar no-print"><span>{state.placementTool ? 'Click a page to place' : 'Stickers'}</span>{['flower', 'star', 'heart', 'leaf', 'butterfly', 'moon', 'sun', 'music'].map(asset => <button aria-label={asset} className={state.placementTool?.assetId === asset ? 'active' : ''} key={asset} onClick={() => choose(asset, 'sticker')}>{GLYPHS[asset]}</button>)}<i /><span>Stamps</span>{['approved', 'date', 'spark', 'important', 'done', 'idea', 'smile'].map(asset => <button aria-label={asset} className={`stamp-button ${state.placementTool?.assetId === asset ? 'active' : ''}`} key={asset} onClick={() => choose(asset, 'stamp')}>{GLYPHS[asset]}</button>)}<i /><button className="photo-button" onClick={addPhoto}>＋ Photo</button>{state.placementTool && <button onClick={() => state.selectPlacement(null)}>Cancel</button>}</aside>
}

function Settings({ close }: { close(): void }) {
  const state = useNotebook(), notebook = state.notebook!
  const [passcode, setPasscode] = useState('')
  const colors: [keyof typeof notebook.style, string][] = [['paperColor', 'Paper'], ['rulingColor', 'Lines'], ['marginLine', 'Margin'], ['defaultTextColor', 'Text'], ['deskBackground', 'Desk']]
  return <div className="scrim"><section className="panel wide"><button className="close" onClick={close}>×</button><h2>Notebook settings</h2><div className="color-grid">{colors.map(([key, label]) => <label key={key}>{label}<input type="color" value={String(notebook.style[key])} onChange={event => state.updateStyle({ [key]: event.target.value })} /></label>)}</div><label>Ruling<select value={notebook.style.ruling} onChange={event => state.updateStyle({ ruling: event.target.value as typeof notebook.style.ruling })}><option value="lined">Lined</option><option value="dotted">Dotted</option><option value="grid">Grid</option><option value="blank">Blank</option></select></label><label>Default font<select value={notebook.style.defaultFont} onChange={event => state.updateStyle({ defaultFont: event.target.value })}>{Object.keys(FONT_PROFILES).map(font => <option key={font}>{font}</option>)}</select></label><label className="inline"><input type="checkbox" checked={state.animations} onChange={event => useNotebook.setState({ animations: event.target.checked })} /> Page animations</label><hr /><h3>Passcode lock</h3><p className="warning">A forgotten passcode cannot be recovered.</p><input type="password" placeholder="New passcode" value={passcode} onChange={event => setPasscode(event.target.value)} /><button disabled={passcode.length < 4} onClick={() => { useNotebook.setState({ passcode }); setPasscode('') }}>Enable encryption</button></section></div>
}

function Cover({ close }: { close(): void }) {
  const state = useNotebook(), cover = state.notebook!.cover
  return <div className="scrim"><section className="panel"><button className="close" onClick={close}>×</button><h2>Design the cover</h2><label>Material<select value={cover.material} onChange={event => state.updateCover({ material: event.target.value as typeof cover.material })}><option>cloth</option><option>leather</option><option>paper</option></select></label><label>Cover<input type="color" value={cover.color} onChange={event => state.updateCover({ color: event.target.value })} /></label><label>Spine<input type="color" value={cover.spineColor} onChange={event => state.updateCover({ spineColor: event.target.value })} /></label><label>Label<input value={cover.label.text} onChange={event => state.updateCover({ label: { ...cover.label, text: event.target.value } })} /></label><label>Label font<select value={cover.label.font} onChange={event => state.updateCover({ label: { ...cover.label, font: event.target.value } })}>{Object.keys(FONT_PROFILES).map(font => <option key={font}>{font}</option>)}</select></label></section></div>
}

function Unlock({ path, cancel }: { path: string; cancel(): void }) {
  const [passcode, setPasscode] = useState(''), [error, setError] = useState(''), setNotebook = useNotebook(state => state.setNotebook)
  return <main className="desk"><form className="panel lock-panel" onSubmit={async event => { event.preventDefault(); try { setNotebook(await window.notebookAPI.load(path, passcode), passcode) } catch { setError('That passcode did not unlock this notebook.') } }}><div className="lock-icon">⌾</div><h2>Notebook locked</h2><input autoFocus type="password" value={passcode} onChange={event => setPasscode(event.target.value)} placeholder="Passcode" />{error && <p className="error">{error}</p>}<button>Unlock</button><button type="button" className="secondary" onClick={cancel}>Cancel</button></form></main>
}

export function PrintApp() {
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  useEffect(() => { void window.notebookAPI.printNotebook().then(value => { if (value) { useNotebook.getState().setNotebook(value); setNotebook(value) } }) }, [])
  if (!notebook) return <main className="print-loading">Preparing notebook…</main>
  return <main className="print-document">
    <section className={`print-cover front material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties}><span className="print-spine"/><span className="cover-label" style={{ color: notebook.cover.label.color }}>{notebook.cover.label.text}</span></section>
    {notebook.pages.map(page => <NotebookPage key={page.index} pageIndex={page.index} print />)}
    <section className={`print-cover back material-${notebook.cover.material}`} style={{ '--cover': notebook.cover.color, '--spine': notebook.cover.spineColor } as React.CSSProperties}><span className="print-spine"/></section>
  </main>
}

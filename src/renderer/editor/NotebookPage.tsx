import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { FONT_PROFILES, PAGE_SIZE, lineCapacity, type DrawingStroke, type PhotoInstance, type StampInstance, type StickerInstance } from '@schema'
import { useNotebook } from '../store'
import { GLYPHS } from '../App'

const FontFamily = Extension.create({
  name: 'fontFamily',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: element => element.style.fontFamily?.replace(/["']/g, ''),
          renderHTML: attributes => attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
        },
      },
    }]
  },
})

export function NotebookPage({ pageIndex, right = false, print = false }: { pageIndex: number; right?: boolean; print?: boolean }) {
  const notebook = useNotebook(s => s.notebook)!
  const updatePage = useNotebook(s => s.updatePage)
  const placementTool = useNotebook(s => s.placementTool)
  const drawingTool = useNotebook(s => s.drawingTool)
  const addDrawing = useNotebook(s => s.addDrawing)
  const removeDrawing = useNotebook(s => s.removeDrawing)
  const addSticker = useNotebook(s => s.addSticker)
  const addStamp = useNotebook(s => s.addStamp)
  const page = notebook.pages[pageIndex]
  const [full, setFull] = useState(false)
  const [preview, setPreview] = useState<{ x: number; y: number }>()
  const [activeStroke, setActiveStroke] = useState<DrawingStroke>()
  const pageRef = useRef<HTMLElement>(null)
  const saved = useRef(page.content)

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] } }), TextStyle, Color, FontFamily],
    content: page.content,
    editorProps: {
      attributes: { class: 'page-editor', spellcheck: 'true' },
      handleKeyDown: (_view, event) => full && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key),
    },
    onUpdate: ({ editor }) => requestAnimationFrame(() => {
      const element = pageRef.current?.querySelector('.tiptap') as HTMLElement | null
      const limit = PAGE_SIZE.height - PAGE_SIZE.paddingTop - PAGE_SIZE.paddingBottom
      if (element && element.scrollHeight > limit + 2) {
        editor.commands.setContent(saved.current, { emitUpdate: false })
        setFull(true)
        return
      }
      const json = editor.getJSON()
      saved.current = json
      setFull(false)
      updatePage(pageIndex, { content: json })
    }),
  }, [pageIndex])

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(page.content)) {
      saved.current = page.content
      editor.commands.setContent(page.content, { emitUpdate: false })
      setFull(false)
    }
  }, [editor, page.content])

  const style = useMemo(() => ({
    '--paper': notebook.style.paperColor,
    '--rule': notebook.style.rulingColor,
    '--margin': notebook.style.marginLine,
    '--line': `${notebook.style.rulingHeight}px`,
    '--ink': notebook.style.defaultTextColor,
    '--font': FONT_PROFILES[notebook.style.defaultFont as keyof typeof FONT_PROFILES]?.family ?? 'serif',
  } as React.CSSProperties), [notebook.style])

  function pageCoordinates(event: ReactPointerEvent) {
    const rect = pageRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(PAGE_SIZE.width, (event.clientX - rect.left) / rect.width * PAGE_SIZE.width)),
      y: Math.max(0, Math.min(PAGE_SIZE.height, (event.clientY - rect.top) / rect.height * PAGE_SIZE.height)),
    }
  }

  function placeDecoration(event: ReactPointerEvent) {
    if (!placementTool || (event.target as HTMLElement).closest('.editor-tools,.decoration')) return false
    event.preventDefault()
    event.stopPropagation()
    const point = pageCoordinates(event)
    const base = { id: crypto.randomUUID(), assetId: placementTool.assetId, ...point, rotation: 0, scale: 1, z: Date.now(), locked: false }
    if (placementTool.kind === 'stamp') addStamp(pageIndex, { ...base, rotation: Math.random() * 8 - 4, inkColor: '#9e3434', seed: Math.random() })
    else addSticker(pageIndex, base)
    useNotebook.getState().selectPlacement(null)
    setPreview(undefined)
    return true
  }

  function startDrawing(event: ReactPointerEvent) {
    if (!drawingTool || drawingTool === 'eraser' || (event.target as HTMLElement).closest('.editor-tools,.decoration')) return false
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    const point = pageCoordinates(event)
    setActiveStroke({ id: crypto.randomUUID(), tool: drawingTool, color: drawingTool === 'pen' ? notebook.style.defaultTextColor : '#f4cf5d', width: drawingTool === 'pen' ? 3 : 18, opacity: drawingTool === 'pen' ? .9 : .35, points: [point, point] })
    return true
  }

  function continueDrawing(event: ReactPointerEvent) {
    if (!activeStroke) return
    const point = pageCoordinates(event)
    setActiveStroke(stroke => stroke ? { ...stroke, points: [...stroke.points, point] } : undefined)
  }

  function finishDrawing(event: ReactPointerEvent) {
    if (!activeStroke) return
    event.preventDefault(); event.stopPropagation()
    if (activeStroke.points.length >= 2) addDrawing(pageIndex, activeStroke)
    setActiveStroke(undefined)
  }

  function chooseRuledLine(event: ReactMouseEvent) {
    if (!editor || placementTool || (event.target as HTMLElement).closest('.editor-tools,.decoration')) return
    const editorElement = pageRef.current?.querySelector('.tiptap') as HTMLElement | null
    const lastBlock = editorElement?.lastElementChild as HTMLElement | null
    if (!editorElement || !lastBlock) return
    const pageRect = pageRef.current!.getBoundingClientRect()
    const writingTop = editorElement.getBoundingClientRect().top
    if (event.clientY < writingTop || event.clientY > pageRect.bottom - pageRect.height * PAGE_SIZE.paddingBottom / PAGE_SIZE.height) return
    const targetLine = Math.max(0, Math.floor((event.clientY - writingTop) / notebook.style.rulingHeight))
    const usedLines = Math.max(1, Math.round((lastBlock.getBoundingClientRect().bottom - writingTop) / notebook.style.rulingHeight))
    const blankLinesNeeded = targetLine - usedLines + 1
    if (blankLinesNeeded <= 0) return
    event.preventDefault()
    editor.chain().focus('end').insertContent('<p></p>'.repeat(blankLinesNeeded)).run()
  }

  function format(action: string) {
    if (!editor) return
    const chain = editor.chain().focus()
    if (action === 'b') chain.toggleBold().run()
    if (action === 'i') chain.toggleItalic().run()
    if (action === 'u') chain.toggleUnderline().run()
    if (action === 'h') chain.toggleHeading({ level: 1 }).run()
    if (action === 'l') chain.toggleBulletList().run()
    if (action === 'n') chain.toggleOrderedList().run()
    if (action === 'q') chain.toggleBlockquote().run()
    if (action === 'r') chain.setHorizontalRule().run()
    if (action === 'c') chain.insertContent('☐ ').run()
    if (action === 'd') chain.setHeading({ level: 2 }).insertContent(new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())).setParagraph().run()
  }

  return <article
    ref={pageRef}
    className={`notebook-page ruling-${notebook.style.ruling} texture-${notebook.style.paperTexture ?? 'clean'} template-${page.template ?? 'standard'} ${right ? 'right-page' : ''} ${full ? 'full' : ''} ${placementTool ? 'placing' : ''} ${drawingTool ? `drawing-${drawingTool}` : ''}`}
    style={style}
    data-lines={lineCapacity(notebook.style.rulingHeight)}
    onPointerMove={event => { if (placementTool) setPreview(pageCoordinates(event)); continueDrawing(event) }}
    onPointerUpCapture={finishDrawing}
    onPointerLeave={() => setPreview(undefined)}
    onPointerDownCapture={event => { if (!startDrawing(event)) placeDecoration(event) }}
    onMouseDownCapture={chooseRuledLine}
  >
    {page.dividerColor && <span className="page-divider" style={{ background: page.dividerColor }} />}
    {page.tabLabel && <span className="page-tab" style={{ background: page.dividerColor ?? '#d7a85c' }}>{page.tabLabel}</span>}
    {!print && <div className="editor-tools no-print">
      {['b', 'i', 'u', 'h', 'l', 'n', 'q', 'r', 'c', 'd'].map(action => <button key={action} title={{ b: 'Bold', i: 'Italic', u: 'Underline', h: 'Heading', l: 'Bullet list', n: 'Numbered list', q: 'Quote', r: 'Divider', c: 'Checkbox', d: 'Date heading' }[action]} onClick={() => format(action)}>{{ l: '•', n: '1.', q: '❝', r: '―', c: '☐', d: 'Date' }[action] ?? action.toUpperCase()}</button>)}
      <select aria-label="Font" defaultValue="" onChange={event => {
        const family = FONT_PROFILES[event.target.value as keyof typeof FONT_PROFILES]?.family
        if (family) editor?.chain().focus().setMark('textStyle', { fontFamily: family }).run()
      }}>
        <option value="" disabled>Font</option>
        {Object.keys(FONT_PROFILES).map(font => <option key={font} value={font}>{font}</option>)}
      </select>
      <input aria-label="Text color" type="color" value={notebook.style.defaultTextColor} onChange={event => editor?.chain().focus().setColor(event.target.value).run()} />
      <select aria-label="Page template" value={page.template ?? 'standard'} onChange={event => updatePage(pageIndex, { template: event.target.value as typeof page.template })}><option value="standard">Notes</option><option value="checklist">Checklist</option><option value="weekly">Weekly planner</option><option value="habit">Habit tracker</option><option value="cornell">Cornell notes</option><option value="music">Music staff</option><option value="sketch">Sketch</option></select>
    </div>}
    <EditorContent editor={editor} />
    {page.template === 'weekly' && <div className="template-labels" aria-hidden="true"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>}
    {page.template === 'habit' && <div className="habit-label" aria-hidden="true">HABIT TRACKER</div>}
    <svg className="drawing-layer" viewBox={`0 0 ${PAGE_SIZE.width} ${PAGE_SIZE.height}`} preserveAspectRatio="none">
      {[...(page.drawings ?? []), ...(activeStroke ? [activeStroke] : [])].map(stroke => <polyline key={stroke.id} points={stroke.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeOpacity={stroke.opacity} strokeLinecap="round" strokeLinejoin="round" onPointerDown={event => { if (drawingTool === 'eraser') { event.preventDefault(); event.stopPropagation(); removeDrawing(pageIndex, stroke.id) } }} />)}
    </svg>
    <div className="decorations">
      {[...page.stickers, ...page.stamps, ...(page.photos ?? [])].map(item => <Decoration key={item.id} pageIndex={pageIndex} item={item} print={print} />)}
      {placementTool && preview && <span className={`placement-preview ${placementTool.kind}`} style={{ left: `${preview.x / PAGE_SIZE.width * 100}%`, top: `${preview.y / PAGE_SIZE.height * 100}%` }}>{GLYPHS[placementTool.assetId]}</span>}
    </div>
    {full && <span className="full-notice no-print">Page full</span>}
    <span className="page-number">{pageIndex + 1}</span>
  </article>
}

function Decoration({ pageIndex, item, print = false }: { pageIndex: number; item: StickerInstance | StampInstance | PhotoInstance; print?: boolean }) {
  const update = useNotebook(s => s.updateDecoration)
  const remove = useNotebook(s => s.removeDecoration)
  const addSticker = useNotebook(s => s.addSticker)
  const addStamp = useNotebook(s => s.addStamp)
  const addPhoto = useNotebook(s => s.addPhoto)
  const [position, setPosition] = useState({ x: item.x, y: item.y })
  const drag = useRef<{ pointerX: number; pointerY: number; x: number; y: number; width: number; height: number } | undefined>(undefined)

  useEffect(() => setPosition({ x: item.x, y: item.y }), [item.x, item.y])

  const isPhoto = 'dataUrl' in item
  const photo = isPhoto ? item : null
  function duplicate() {
    const copy = { ...item, id: crypto.randomUUID(), x: Math.min(PAGE_SIZE.width, item.x + 24), y: Math.min(PAGE_SIZE.height, item.y + 24), z: Date.now(), locked: false }
    if ('dataUrl' in copy) addPhoto(pageIndex, copy)
    else if ('inkColor' in copy) addStamp(pageIndex, copy)
    else addSticker(pageIndex, copy)
  }
  function control(event: ReactPointerEvent, action: () => void) { event.preventDefault(); event.stopPropagation(); action() }
  return <button
    className={`${isPhoto ? `decoration photo frame-${item.frame} filter-${item.filter} fit-${item.fit}` : 'inkColor' in item ? 'decoration stamp' : 'decoration sticker'} ${item.locked ? 'locked' : ''}`}
    aria-label={`${isPhoto ? `Photo ${item.name}` : 'inkColor' in item ? `Stamp ${item.assetId}` : `Sticker ${item.assetId}`}. Use arrow keys to move and Delete to remove.`}
    title={item.locked ? 'Locked decoration' : 'Drag to move · use controls to edit'}
    style={{ left: `${position.x / PAGE_SIZE.width * 100}%`, top: `${position.y / PAGE_SIZE.height * 100}%`, transform: `translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`, zIndex: item.z, color: 'inkColor' in item ? item.inkColor : undefined }}
    onDoubleClick={() => !print && remove(pageIndex, item.id)}
    onPointerDown={event => {
      if (print || item.locked) return
      event.stopPropagation()
      const rect = event.currentTarget.closest('.notebook-page')!.getBoundingClientRect()
      drag.current = { pointerX: event.clientX, pointerY: event.clientY, x: position.x, y: position.y, width: rect.width, height: rect.height }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      if (!drag.current) return
      event.stopPropagation()
      setPosition({
        x: Math.max(0, Math.min(PAGE_SIZE.width, drag.current.x + (event.clientX - drag.current.pointerX) / drag.current.width * PAGE_SIZE.width)),
        y: Math.max(0, Math.min(PAGE_SIZE.height, drag.current.y + (event.clientY - drag.current.pointerY) / drag.current.height * PAGE_SIZE.height)),
      })
    }}
    onPointerUp={event => {
      if (!drag.current) return
      event.stopPropagation()
      drag.current = undefined
      update(pageIndex, item.id, position)
    }}
    onKeyDown={event => {
      if (print) return
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(pageIndex, item.id); return }
      if (!item.locked && event.key.startsWith('Arrow')) { event.preventDefault(); const step = event.shiftKey ? 10 : 2; update(pageIndex, item.id, { x: item.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: item.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }) }
    }}
  >{isPhoto ? <><img src={item.dataUrl} alt={item.name} style={{ objectPosition: `${item.cropX}% ${item.cropY}%` }} />{item.caption && <small className="photo-caption">{item.caption}</small>}</> : GLYPHS[item.assetId] ?? '✦'}{!print && <span className="decoration-controls"><span title="Rotate left" onPointerDown={event => control(event, () => update(pageIndex, item.id, { rotation: item.rotation - 15 }))}>↶</span><span title="Rotate right" onPointerDown={event => control(event, () => update(pageIndex, item.id, { rotation: item.rotation + 15 }))}>↷</span><span title="Smaller" onPointerDown={event => control(event, () => update(pageIndex, item.id, { scale: Math.max(.35, item.scale - .15) }))}>−</span><span title="Larger" onPointerDown={event => control(event, () => update(pageIndex, item.id, { scale: Math.min(3, item.scale + .15) }))}>＋</span><span title="Send backward" onPointerDown={event => control(event, () => update(pageIndex, item.id, { z: item.z - 1 }))}>↓</span><span title="Bring to front" onPointerDown={event => control(event, () => update(pageIndex, item.id, { z: Date.now() }))}>↑</span>{photo && <><span title="Cycle photo frame" onPointerDown={event => control(event, () => { const frames: PhotoInstance['frame'][] = ['plain', 'polaroid', 'tape', 'shadow']; update(pageIndex, item.id, { frame: frames[(frames.indexOf(photo.frame) + 1) % frames.length] }) })}>▣</span><span title="Cycle photo filter" onPointerDown={event => control(event, () => { const filters: PhotoInstance['filter'][] = ['none', 'mono', 'sepia']; update(pageIndex, item.id, { filter: filters[(filters.indexOf(photo.filter) + 1) % filters.length] }) })}>◐</span><span title="Toggle crop or fit" onPointerDown={event => control(event, () => update(pageIndex, item.id, { fit: photo.fit === 'crop' ? 'contain' : 'crop' }))}>↔</span><span title="Move crop focus left" onPointerDown={event => control(event, () => update(pageIndex, item.id, { cropX: Math.max(0, photo.cropX - 10) }))}>◀</span><span title="Move crop focus right" onPointerDown={event => control(event, () => update(pageIndex, item.id, { cropX: Math.min(100, photo.cropX + 10) }))}>▶</span><span title="Edit caption" onPointerDown={event => control(event, () => { const caption = prompt('Photo caption', photo.caption ?? ''); if (caption !== null) update(pageIndex, item.id, { caption: caption || undefined }) })}>Aa</span></>}<span title="Duplicate" onPointerDown={event => control(event, duplicate)}>⧉</span><span title={item.locked ? 'Unlock' : 'Lock'} onPointerDown={event => control(event, () => update(pageIndex, item.id, { locked: !item.locked }))}>{item.locked ? '🔓' : '🔒'}</span><span title="Delete" onPointerDown={event => control(event, () => remove(pageIndex, item.id))}>×</span></span>}</button>
}

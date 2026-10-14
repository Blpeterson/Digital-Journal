import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { FONT_PROFILES, PAGE_SIZE, lineCapacity, type PhotoInstance, type StampInstance, type StickerInstance } from '@schema'
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
  const addSticker = useNotebook(s => s.addSticker)
  const addStamp = useNotebook(s => s.addStamp)
  const page = notebook.pages[pageIndex]
  const [full, setFull] = useState(false)
  const [preview, setPreview] = useState<{ x: number; y: number }>()
  const pageRef = useRef<HTMLElement>(null)
  const saved = useRef(page.content)

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] } }), Underline, TextStyle, Color, FontFamily],
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
    const base = { id: crypto.randomUUID(), assetId: placementTool.assetId, ...point, rotation: 0, scale: 1, z: Date.now() }
    if (placementTool.kind === 'stamp') addStamp(pageIndex, { ...base, rotation: Math.random() * 8 - 4, inkColor: '#9e3434', seed: Math.random() })
    else addSticker(pageIndex, base)
    useNotebook.getState().selectPlacement(null)
    setPreview(undefined)
    return true
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
  }

  return <article
    ref={pageRef}
    className={`notebook-page ruling-${notebook.style.ruling} ${right ? 'right-page' : ''} ${full ? 'full' : ''} ${placementTool ? 'placing' : ''}`}
    style={style}
    data-lines={lineCapacity(notebook.style.rulingHeight)}
    onPointerMove={event => placementTool && setPreview(pageCoordinates(event))}
    onPointerLeave={() => setPreview(undefined)}
    onPointerDownCapture={event => { placeDecoration(event) }}
    onMouseDownCapture={chooseRuledLine}
  >
    {!print && <div className="editor-tools no-print">
      {['b', 'i', 'u', 'h', 'l'].map(action => <button key={action} onClick={() => format(action)}>{action === 'l' ? '• List' : action.toUpperCase()}</button>)}
      <select aria-label="Font" defaultValue="" onChange={event => {
        const family = FONT_PROFILES[event.target.value as keyof typeof FONT_PROFILES]?.family
        if (family) editor?.chain().focus().setMark('textStyle', { fontFamily: family }).run()
      }}>
        <option value="" disabled>Font</option>
        {Object.keys(FONT_PROFILES).map(font => <option key={font} value={font}>{font}</option>)}
      </select>
      <input aria-label="Text color" type="color" value={notebook.style.defaultTextColor} onChange={event => editor?.chain().focus().setColor(event.target.value).run()} />
    </div>}
    <EditorContent editor={editor} />
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
  const [position, setPosition] = useState({ x: item.x, y: item.y })
  const drag = useRef<{ pointerX: number; pointerY: number; x: number; y: number; width: number; height: number } | undefined>(undefined)

  useEffect(() => setPosition({ x: item.x, y: item.y }), [item.x, item.y])

  const isPhoto = 'dataUrl' in item
  return <button
    className={isPhoto ? 'decoration photo' : 'inkColor' in item ? 'decoration stamp' : 'decoration sticker'}
    title="Drag to move · double-click to delete"
    style={{ left: `${position.x / PAGE_SIZE.width * 100}%`, top: `${position.y / PAGE_SIZE.height * 100}%`, transform: `translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`, zIndex: item.z, color: 'inkColor' in item ? item.inkColor : undefined }}
    onDoubleClick={() => !print && remove(pageIndex, item.id)}
    onPointerDown={event => {
      if (print) return
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
  >{isPhoto ? <img src={item.dataUrl} alt={item.name} /> : GLYPHS[item.assetId] ?? '✦'}{!print && <span className="decoration-controls"><span onPointerDown={event => { event.stopPropagation(); update(pageIndex, item.id, { rotation: item.rotation - 15 }) }}>↶</span><span onPointerDown={event => { event.stopPropagation(); update(pageIndex, item.id, { rotation: item.rotation + 15 }) }}>↷</span></span>}</button>
}

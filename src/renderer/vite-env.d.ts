/// <reference types="vite/client" />
import type { Notebook, NotebookSummary } from '../../packages/schema'
declare global { interface Window { notebookAPI: { openDialog(): Promise<{ canceled: boolean; filePaths: string[] }>; save(notebook: Notebook, passcode?: string): Promise<string>; load(path: string, passcode?: string): Promise<Notebook>; list(): Promise<{ directory: string; notebooks: NotebookSummary[] }>; exportPdf(title: string, notebook: Notebook): Promise<string | null>; choosePhoto(): Promise<{ name: string; dataUrl: string } | null>; printNotebook(): Promise<Notebook | null> } } }
export {}

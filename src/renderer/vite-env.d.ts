/// <reference types="vite/client" />
import type { Notebook, NotebookSummary } from '../../packages/schema'
declare global { interface Window { notebookAPI: { openDialog(): Promise<{ canceled: boolean; filePaths: string[] }>; save(notebook: Notebook, passcode?: string): Promise<string>; load(path: string, passcode?: string): Promise<Notebook>; list(): Promise<{ directory: string; notebooks: NotebookSummary[] }>; exportPdf(title: string): Promise<string | null> } } }
export {}

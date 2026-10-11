/// <reference types="vite/client" />
import type { Notebook } from '../../packages/schema'
declare global { interface Window { notebookAPI: { openDialog(): Promise<{ canceled: boolean; filePaths: string[] }>; save(notebook: Notebook, passcode?: string): Promise<string>; load(path: string, passcode?: string): Promise<Notebook>; exportPdf(title: string): Promise<string | null> } } }
export {}

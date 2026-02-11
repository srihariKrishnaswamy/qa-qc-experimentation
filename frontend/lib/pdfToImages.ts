/**
 * Convert a PDF file to an array of page images (base64 JPEG) in the browser.
 * Uses pdfjs-dist; only call from client components.
 */

export type PdfPageImage = { base64: string; mimeType: 'image/jpeg' }

const PDFJS_WORKER_VERSION = '4.10.38'

export async function pdfToImages(pdfFile: File): Promise<PdfPageImage[]> {
  if (typeof window === 'undefined') {
    throw new Error('pdfToImages must run in the browser')
  }

  const pdfjsLib = await import('pdfjs-dist')
  const pdfjsGlobal = pdfjsLib as typeof pdfjsLib & {
    GlobalWorkerOptions?: { workerSrc: string }
  }
  if (pdfjsGlobal.GlobalWorkerOptions) {
    pdfjsGlobal.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_WORKER_VERSION}/build/pdf.worker.min.mjs`
  }

  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages
  const result: PdfPageImage[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const scale = 2
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2d context not available')
    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'print',
    }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
    result.push({ base64, mimeType: 'image/jpeg' })
  }

  return result
}

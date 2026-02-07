'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { processSpecPdf, PIPELINE_RULES_STORAGE_KEY } from '@/lib/rulesApi'

type UploadFile = {
  file: File
  progress: number
  estimatedSecondsLeft: number | null
  status: 'uploading' | 'complete' | 'error'
}

const RULES_API_URL = process.env.NEXT_PUBLIC_RULES_API_URL
const INGEST_API_URL =
  process.env.NEXT_PUBLIC_INGEST_API_URL ??
  'https://pkru6dhsqi.execute-api.us-west-2.amazonaws.com/prod'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadSpecbook() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [usedPipeline, setUsedPipeline] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadIdRef = useRef(0)
  const presignAbortRef = useRef<AbortController | null>(null)

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setSelectedFile(null)
        setUsedPipeline(false)
        return
      }
      if (file.type !== 'application/pdf') return
      const uploadId = ++uploadIdRef.current
      setUploadError(null)
      setUsedPipeline(!!RULES_API_URL)
      setSelectedFile({
        file,
        progress: 0,
        estimatedSecondsLeft: null,
        status: 'uploading',
      })

      presignAbortRef.current?.abort()
      const controller = new AbortController()
      presignAbortRef.current = controller

      try {
        if (RULES_API_URL) {
          console.log('[pipeline] request', { name: file.name })
          const result = await processSpecPdf(file)
          if (uploadIdRef.current !== uploadId) return
          try {
            sessionStorage.setItem(
              PIPELINE_RULES_STORAGE_KEY,
              JSON.stringify({ rules: result.rules })
            )
          } catch {
            // ignore storage errors
          }
          setSelectedFile((prev) =>
            prev
              ? {
                  ...prev,
                  progress: 100,
                  estimatedSecondsLeft: 0,
                  status: 'complete',
                }
              : null
          )
          return
        }

        console.log('[quick-ingestion] request', {
          name: file.name,
          contentType: file.type,
        })
        const response = await fetch(`${INGEST_API_URL}/quick-ingestion`, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
          signal: controller.signal,
        })
        if (!response.ok) {
          const errorBody = await response.text()
          throw new Error(`Quick ingestion failed (${response.status}): ${errorBody}`)
        }
        const quickPayload = await response.json()
        console.log('[quick-ingestion] response', quickPayload)
        if (uploadIdRef.current !== uploadId) return

        setSelectedFile((prev) =>
          prev
            ? {
                ...prev,
                progress: 100,
                estimatedSecondsLeft: 0,
                status: 'complete',
              }
            : null
        )
      } catch (error) {
        if (uploadIdRef.current !== uploadId) return
        if (error instanceof DOMException && error.name === 'AbortError') return

        console.error('[upload] error', error)
        setUploadError(error instanceof Error ? error.message : 'Upload failed')
        setSelectedFile((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
              }
            : null
        )
      }
    },
    []
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type === 'application/pdf') handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleSelectFile = () => inputRef.current?.click()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    handleFile(file ?? null)
    e.target.value = ''
  }

  const cancelUpload = () => {
    console.log('[upload] cancel')
    presignAbortRef.current?.abort()
    setUploadError(null)
    setSelectedFile(null)
    setUsedPipeline(false)
  }

  const handleNext = () => {
    if (!selectedFile || selectedFile.status !== 'complete') return
    if (usedPipeline) {
      router.push('/rules')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-medium text-gray-900 mb-6">Upload Specbook</h1>
      {RULES_API_URL && (
        <p className="text-sm text-gray-500 mb-4">
          Using pipeline backend — PDF is sent to your local API and rules are returned directly (no Amplify/AppSync).
        </p>
      )}

      {/* Drag & drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-dashed-custom rounded-lg p-12 text-center transition-colors
          ${isDragging ? '[--dash-color:theme(colors.primary.DEFAULT)] bg-[#F0FCFF]' : '[--dash-color:theme(colors.gray.300)] bg-gray-50/50'}
        `}
      >
        {/* Upload icon */}
        <div className="flex justify-center mb-4">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-gray-700 font-medium mb-1">Drag & drop your file here</p>
        <p className="text-gray-500 text-sm mb-6">Supported types: PDF</p>
        <button
          type="button"
          onClick={handleSelectFile}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Select file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Upload progress */}
      {selectedFile && (
        <div className="mt-6">
          <h2 className="text-sm font-regular text-gray-700 mb-3">
            {selectedFile.status === 'uploading'
              ? 'Processing PDF...'
              : selectedFile.status === 'complete'
                ? 'Upload complete'
                : selectedFile.status === 'error'
                  ? 'Upload failed'
                  : '1 file uploading...'}
          </h2>
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="w-8 h-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-regular text-gray-900 truncate">
                {selectedFile.file.name}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatFileSize(selectedFile.file.size)}
                {selectedFile.status === 'uploading' &&
                  selectedFile.estimatedSecondsLeft !== null && (
                    <> • {selectedFile.estimatedSecondsLeft} sec left</>
                  )}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${selectedFile.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-10">
                  {Math.round(selectedFile.progress)}%
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelUpload}
              className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              aria-label="Cancel upload"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {uploadError && (
            <p className="text-sm text-red-600 mt-3" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={cancelUpload}
          className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!selectedFile || selectedFile.status !== 'complete'}
        >
          Next
        </button>
      </div>
    </div>
  )
}

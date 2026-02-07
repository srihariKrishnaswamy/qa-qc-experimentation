'use client'

import { useState, useRef, useCallback } from 'react'
import { verifyRule } from '@/lib/rulesApi'

export type RuleItem = {
  rule?: string | null
  dimension?: string | null
  source_page?: string | null
  shall_statement?: string | null
}

function parseJsonString(str: string): RuleItem[] {
  let s = str.trim()
  if (s.startsWith('```')) {
    const firstLine = s.split('\n')[0] ?? ''
    s = s.slice(firstLine.length).trim()
    if (s.endsWith('```')) s = s.slice(0, -3).trim()
  }
  try {
    const parsed = JSON.parse(s) as unknown
    return Array.isArray(parsed) ? parsed.filter((r): r is RuleItem => typeof r === 'object' && r !== null) : []
  } catch {
    return []
  }
}

function normalizeRules(rules: unknown): RuleItem[] {
  if (Array.isArray(rules)) {
    return rules.filter((r): r is RuleItem => typeof r === 'object' && r !== null)
  }
  if (typeof rules === 'string') {
    return parseJsonString(rules)
  }
  if (typeof rules === 'object' && rules !== null) {
    const o = rules as Record<string, unknown>
    if ('raw' in o && typeof o.raw === 'string') {
      return parseJsonString(o.raw)
    }
    if ('rules' in o && Array.isArray(o.rules)) {
      return (o.rules as unknown[]).filter((r): r is RuleItem => typeof r === 'object' && r !== null)
    }
  }
  return []
}

function RuleRow({
  item,
  index,
  verified,
  checked,
  onVerify,
  onToggle,
}: {
  item: RuleItem
  index: number
  verified: boolean
  checked: boolean
  onVerify: () => void
  onToggle: () => void
}) {
  const title = item.rule ?? 'Rule'
  const sub = [item.dimension, item.shall_statement].filter(Boolean).join(' — ')
  const page = item.source_page != null ? `Page ${item.source_page}` : null

  return (
    <div className="flex gap-3 items-start group rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300 hover:shadow transition-colors">
      <input
        type="checkbox"
        checked={checked}
        disabled={!verified}
        onChange={onToggle}
        title={verified ? 'Mark as complete' : 'Verify with a photo first to enable'}
        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label={verified ? `Mark rule complete: ${title}` : `Verify rule first: ${title}`}
      />
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onVerify}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onVerify()}
        aria-label={`Verify rule: ${title}`}
      >
        <p className="font-medium text-gray-900 group-hover:text-gray-700">{title}</p>
        {sub ? <p className="text-sm text-gray-600 mt-1 leading-snug">{sub}</p> : null}
        {page ? <p className="text-xs text-gray-400 mt-1.5">{page}</p> : null}
        {verified ? (
          <p className="mt-2 text-sm font-medium text-green-700 flex items-center gap-1.5">
            <span aria-hidden>✓</span> Verified with photo
          </p>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onVerify() }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            Verify with photo →
          </button>
        )}
      </div>
    </div>
  )
}

function VerifyRuleModal({
  item,
  onClose,
  onPhotoSelected,
  loading,
  error,
}: {
  item: RuleItem
  onClose: () => void
  onPhotoSelected: (file: File) => Promise<void>
  loading: boolean
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const title = item.rule ?? 'Rule'
  const dimension = item.dimension ?? null
  const shall = item.shall_statement ?? null
  const page = item.source_page != null ? `Page ${item.source_page}` : null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      onPhotoSelected(file)
    }
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={loading ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
            <p className="text-gray-700 font-medium">Verifying with AI...</p>
          </div>
        )}
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Verify this rule</h2>
        <div className="space-y-2 text-sm text-gray-700 mb-4">
          <p className="font-medium text-gray-900">{title}</p>
          {dimension ? <p><span className="text-gray-500">Dimension:</span> {dimension}</p> : null}
          {shall ? <p className="leading-snug"><span className="text-gray-500">Shall:</span> {shall}</p> : null}
          {page ? <p className="text-gray-500">{page}</p> : null}
        </div>
        <p className="text-sm text-gray-600 mb-4">Take a photo or upload an image of the installation so we can verify it against this rule.</p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-800">Verification failed</p>
            <p className="text-sm text-red-700 mt-0.5 whitespace-pre-wrap">{error}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Select or capture photo"
          disabled={loading}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50"
          >
            Take photo / Upload
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function RulesListWithCheckboxes({ rules }: { rules: unknown }) {
  const items = normalizeRules(rules)
  const [verifiedIndices, setVerifiedIndices] = useState<Set<number>>(new Set())
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [verifyIndex, setVerifyIndex] = useState<number | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const openVerify = useCallback((index: number) => {
    setVerifyIndex(index)
    setVerifyError(null)
  }, [])
  const closeVerify = useCallback(() => {
    if (!verifyLoading) {
      setVerifyIndex(null)
      setVerifyError(null)
    }
  }, [verifyLoading])

  const handlePhotoSelected = useCallback(
    async (file: File) => {
      if (verifyIndex === null) return
      const item = items[verifyIndex]
      if (!item) return
      setVerifyLoading(true)
      setVerifyError(null)
      try {
        const result = await verifyRule(file, item)
        if (result.verified) {
          setVerifiedIndices((prev) => new Set([...prev, verifyIndex]))
          setVerifyIndex(null)
          setVerifyError(null)
        } else {
          setVerifyError(result.message || 'Photo does not show compliance with this rule.')
        }
      } catch (e) {
        setVerifyError(e instanceof Error ? e.message : 'Verification failed. Try again.')
      } finally {
        setVerifyLoading(false)
      }
    },
    [verifyIndex, items]
  )

  const toggleChecked = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  if (items.length === 0) {
    return (
      <p className="text-gray-500 py-4">No rules to display. The response may not be in the expected format.</p>
    )
  }

  const verifyingItem = verifyIndex !== null ? items[verifyIndex] ?? null : null

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">
        Total: <span className="text-gray-900">{items.length}</span> rule{items.length === 1 ? '' : 's'} extracted
      </p>
      <div className="overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3 max-h-[70vh] min-h-[200px]">
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i}>
              <RuleRow
                item={item}
                index={i}
                verified={verifiedIndices.has(i)}
                checked={checked.has(i)}
                onVerify={() => openVerify(i)}
                onToggle={() => toggleChecked(i)}
              />
            </li>
          ))}
        </ul>
      </div>
      {verifyingItem !== null && (
        <VerifyRuleModal
          item={verifyingItem}
          onClose={closeVerify}
          onPhotoSelected={handlePhotoSelected}
          loading={verifyLoading}
          error={verifyError}
        />
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RulesListWithCheckboxes } from '@/components/RulesListWithCheckboxes'
import { PIPELINE_RULES_STORAGE_KEY } from '@/lib/rulesApi'

/**
 * Rules page for pipeline backend only. Reads rules from sessionStorage
 * (written after POST /api/rules/extract). No Amplify, no AppSync, no listener.
 */
export default function PipelineRulesPage() {
  const [rules, setRules] = useState<unknown>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PIPELINE_RULES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { rules?: unknown }
        if (parsed.rules !== undefined) {
          const r = parsed.rules
          const kind = Array.isArray(r) ? 'array' : typeof r
          const count = Array.isArray(r) ? r.length : (typeof r === 'object' && r !== null && 'raw' in r ? 'object with raw' : 'other')
          if (typeof console !== 'undefined' && console.debug) {
            console.debug('[rules page] loaded rules:', kind, count, r)
          }
          setRules(parsed.rules)
        }
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  if (!loaded) {
    return (
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-500">Loading...</p>
        </div>
      </main>
    )
  }

  if (!rules) {
    return (
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-600">No rules found. Upload a spec PDF on the home page.</p>
          <p className="mt-4">
            <Link href="/" className="text-primary hover:underline">
              ← Back to upload
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-medium text-gray-900">Extracted Rules (Pipeline)</h1>
          <Link href="/" className="text-sm text-primary hover:underline">
            Upload another PDF
          </Link>
        </div>
        <RulesListWithCheckboxes rules={rules} />
      </div>
    </main>
  )
}

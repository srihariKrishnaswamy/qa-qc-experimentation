'use client'

import { useState } from 'react'

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
  checked,
  onToggle,
}: {
  item: RuleItem
  index: number
  checked: boolean
  onToggle: () => void
}) {
  const title = item.rule ?? 'Rule'
  const sub = [item.dimension, item.shall_statement].filter(Boolean).join(' — ')
  const page = item.source_page != null ? `Page ${item.source_page}` : null

  return (
    <label className="flex gap-3 items-start cursor-pointer group rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300 hover:shadow transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
        aria-label={`Toggle rule: ${title}`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 group-hover:text-gray-700">{title}</p>
        {sub ? <p className="text-sm text-gray-600 mt-1 leading-snug">{sub}</p> : null}
        {page ? <p className="text-xs text-gray-400 mt-1.5">{page}</p> : null}
      </div>
    </label>
  )
}

export function RulesListWithCheckboxes({ rules }: { rules: unknown }) {
  const items = normalizeRules(rules)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-gray-500 py-4">No rules to display. The response may not be in the expected format.</p>
    )
  }

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
                checked={checked.has(i)}
                onToggle={() => toggle(i)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

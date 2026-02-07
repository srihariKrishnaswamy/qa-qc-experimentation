import React from 'react'

export type RuleSubtitleBody = { subtitle: string; body: string }

export function getRuleSubtitleAndBody(r: unknown): RuleSubtitleBody | null {
  if (typeof r === 'string') return { subtitle: r, body: '' }
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  if ('description' in o && o.description != null) {
    const subtitle = String(o.description)
    const reqs = Array.isArray(o.requirements) ? o.requirements : []
    const body = reqs
      .map((x: unknown) => (typeof x === 'string' ? x : String(x)))
      .join('\n')
    return { subtitle, body }
  }
  if ('rule' in o && o.rule != null) {
    const subtitle = String(o.rule)
    const body =
      'shall_statement' in o && o.shall_statement != null
        ? String(o.shall_statement)
        : ''
    return { subtitle, body }
  }
  if ('text' in o && o.text != null) return { subtitle: String(o.text), body: '' }
  return null
}

function RuleCard({ subtitle, body }: { subtitle: string; body: string }) {
  return (
    <div className="rounded-lg bg-gray-100 p-4">
      <p className="text-sm font-medium text-gray-900 mb-1">{subtitle}</p>
      {body ? (
        <p className="text-gray-700 text-[15px] leading-normal whitespace-pre-wrap">
          {body}
        </p>
      ) : null}
    </div>
  )
}

function RuleCards({ items }: { items: unknown[] }) {
  return (
    <div className="space-y-3">
      {items.map((r: unknown, i: number) => {
        const parsed = getRuleSubtitleAndBody(r)
        if (!parsed) {
          return (
            <div key={i} className="rounded-lg bg-gray-100 p-4">
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(r)}
              </pre>
            </div>
          )
        }
        return (
          <RuleCard key={i} subtitle={parsed.subtitle} body={parsed.body} />
        )
      })}
    </div>
  )
}

export function GeneratedRulesDisplay({ rules }: { rules: unknown }) {
  if (!rules) return null

  if (typeof rules === 'object' && rules !== null && !Array.isArray(rules)) {
    const obj = rules as Record<string, unknown>
    return (
      <div className="space-y-6">
        {Object.entries(obj).map(([trade, tradeRules]) => (
          <div key={trade}>
            <h3 className="text-lg font-semibold text-gray-900 capitalize mb-3">
              {trade}
            </h3>
            {Array.isArray(tradeRules) ? (
              <RuleCards items={tradeRules} />
            ) : (
              <pre className="text-sm text-gray-600 overflow-x-auto bg-gray-50 p-4 rounded-lg">
                {JSON.stringify(tradeRules, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (Array.isArray(rules)) {
    return <RuleCards items={rules} />
  }

  return (
    <pre className="text-sm text-gray-600 overflow-x-auto bg-gray-50 p-4 rounded-lg">
      {JSON.stringify(rules, null, 2)}
    </pre>
  )
}

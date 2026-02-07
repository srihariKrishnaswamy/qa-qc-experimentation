'use client'

import { Suspense } from 'react'
import { ListenerRulesView } from '@/components/ListenerRulesView'

function RulesFallback() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <p className="text-gray-500">Loading...</p>
      </div>
    </main>
  )
}

export default function ListenerRulesPage() {
  return (
    <Suspense fallback={<RulesFallback />}>
      <ListenerRulesView />
    </Suspense>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Amplify } from 'aws-amplify'
import { events } from 'aws-amplify/data'
import { GeneratedRulesDisplay } from './GeneratedRulesDisplay'

export const RULES_STORAGE_KEY = 'specbook-rules'

const EVENTS_HTTP_URL =
  process.env.NEXT_PUBLIC_EVENTS_HTTP_URL ??
  'https://iegrfvivfnbkvgooxlfxja34om.appsync-api.us-west-2.amazonaws.com/event'
const EVENTS_API_KEY =
  process.env.NEXT_PUBLIC_EVENTS_API_KEY ?? 'da2-a5bvz7uqsvef7emaxpgotebmrq'
const EVENTS_CHANNEL =
  process.env.NEXT_PUBLIC_EVENTS_CHANNEL ?? 'specbook/processed'
const EVENTS_REGION = process.env.NEXT_PUBLIC_EVENTS_REGION ?? 'us-west-2'

type EventPayload = {
  inputKey?: string
  inputS3Uri?: string
  outputKey?: string
  rules?: unknown
  [key: string]: unknown
}

function extractEventPayload(message: unknown): EventPayload | null {
  if (!message || typeof message !== 'object') return null
  const candidate =
    (message as { payload?: unknown }).payload ??
    (message as { event?: unknown }).event ??
    (message as { data?: unknown }).data ??
    message

  if (!candidate || typeof candidate !== 'object') return null
  const payload =
    (candidate as { payload?: unknown }).payload ??
    (candidate as { event?: unknown }).event ??
    candidate

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload)
      return typeof parsed === 'object' ? (parsed as EventPayload) : null
    } catch {
      return null
    }
  }

  return typeof payload === 'object' ? (payload as EventPayload) : null
}

function matchEventToS3Key(payload: EventPayload, expectedKey: string): boolean {
  return (
    payload.inputKey === expectedKey ||
    (!!payload.inputS3Uri && payload.inputS3Uri.includes(expectedKey)) ||
    (!!payload.outputKey &&
      payload.outputKey.includes(expectedKey.replace(/\.pdf$/i, '.rules.json')))
  )
}

function getSampleRulesUrl(sample: string): string {
  if (sample === '02') return '/sample-rules-02.json'
  return '/sample-rules.json'
}

export function ListenerRulesView() {
  const searchParams = useSearchParams()
  const s3Key = searchParams.get('s3Key')
  const sample = searchParams.get('sample')
  const [rules, setRules] = useState<unknown>(null)
  const [status, setStatus] = useState<'loading' | 'processing' | 'ready'>(
    'loading'
  )
  const [error, setError] = useState<string | null>(null)
  const amplifyConfiguredRef = useRef(false)
  const eventsChannelRef = useRef<{ close?: () => void } | null>(null)

  useEffect(() => {
    if (!sample) return
    const url = getSampleRulesUrl(sample)
    setStatus('loading')
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load sample: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setRules(data)
        setStatus('ready')
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load sample rules'
        )
        setStatus('ready')
      })
  }, [sample])

  const checkStorageAndListen = useCallback(
    async (expectedKey: string) => {
      try {
        const stored = sessionStorage.getItem(RULES_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as {
            s3Key?: string
            rules?: unknown
          }
          if (parsed.s3Key === expectedKey && parsed.rules !== undefined) {
            setRules(parsed.rules)
            setStatus('ready')
            sessionStorage.removeItem(RULES_STORAGE_KEY)
            return
          }
        }
      } catch {
        // ignore
      }

      setStatus('processing')

      if (!EVENTS_HTTP_URL || !EVENTS_API_KEY) {
        setError('Events configuration missing')
        setStatus('ready')
        return
      }

      if (!amplifyConfiguredRef.current) {
        Amplify.configure({
          API: {
            Events: {
              endpoint: EVENTS_HTTP_URL,
              region: EVENTS_REGION,
              apiKey: EVENTS_API_KEY,
              defaultAuthMode: 'apiKey',
            },
          },
        })
        amplifyConfiguredRef.current = true
      }

      if (eventsChannelRef.current?.close) {
        eventsChannelRef.current.close()
        eventsChannelRef.current = null
      }

      const channel = await events.connect(EVENTS_CHANNEL)
      eventsChannelRef.current = channel as { close?: () => void }
      channel.subscribe({
        next: (data: unknown) => {
          const payload = extractEventPayload(data)
          if (!payload || !matchEventToS3Key(payload, expectedKey)) return
          const rulesPayload = payload.rules
          if (rulesPayload !== undefined) {
            setRules(rulesPayload)
            setStatus('ready')
            if (eventsChannelRef.current?.close) {
              eventsChannelRef.current.close()
              eventsChannelRef.current = null
            }
          }
        },
        error: (err: unknown) => {
          console.warn('[rules] subscription error', err)
          setError('Failed to receive rules. Please try again.')
          setStatus('ready')
        },
      })
    },
    []
  )

  useEffect(() => {
    if (sample || !s3Key) return
    checkStorageAndListen(s3Key)
    return () => {
      if (eventsChannelRef.current?.close) {
        eventsChannelRef.current.close()
        eventsChannelRef.current = null
      }
    }
  }, [sample, s3Key, checkStorageAndListen])

  if (!sample && !s3Key) {
    return (
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-600">No upload specified.</p>
          <p className="text-sm text-gray-500 mt-2">
            <Link
              href="/listener/rules?sample=1"
              className="text-primary hover:underline"
            >
              Test with sample rules
            </Link>
            {' (no AWS required)'}
          </p>
          <Link
            href="/listener"
            className="mt-4 inline-block text-primary hover:underline"
          >
            ← Back to upload
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <Link
          href="/listener"
          className="text-primary hover:underline font-medium mb-4 inline-block"
        >
          ← Back to upload
        </Link>
        <h1 className="text-xl font-medium text-gray-900 mb-6">
          Generated Rules
        </h1>

        {status === 'loading' && (
          <p className="text-gray-500">Loading...</p>
        )}

        {status === 'processing' && (
          <div className="flex items-center gap-3 text-gray-600">
            <svg
              className="animate-spin h-5 w-5 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p>Processing your PDF. Rules will appear when ready.</p>
          </div>
        )}

        {error && (
          <p className="text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {status === 'ready' && rules !== null && (
          <GeneratedRulesDisplay rules={rules} />
        )}

        {status === 'ready' && rules === null && !error && (
          <p className="text-gray-500">
            No rules received yet. The PDF may still be processing.
          </p>
        )}
      </div>
    </main>
  )
}

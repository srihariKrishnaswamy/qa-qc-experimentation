import Link from 'next/link'
import UploadSpecbookAndListen from '@/components/UploadSpecbookAndListen'

export default function ListenerPage() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <p className="text-center text-sm text-gray-500 mb-4">
        No AWS?{' '}
        <Link href="/listener/rules?sample=1" className="text-primary hover:underline">
          Test with sample rules
        </Link>
        {' (uses JSON from ingestionservice/analysis/generated)'}
      </p>
      <UploadSpecbookAndListen />
    </main>
  )
}

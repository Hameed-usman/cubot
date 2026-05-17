'use client'
 
import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled application error:', error)
  }, [error])
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong!</h2>
        <p className="text-slate-500 mb-6">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-cu-blue hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

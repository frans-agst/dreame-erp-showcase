import Link from 'next/link';

/**
 * 404 Not Found Page
 * Displayed when a user navigates to a non-existent route
 * Requirements: 10.4 - Proper error handling with user-friendly messages
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl shadow-soft p-8 md:p-12 text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-greenLight flex items-center justify-center">
          <svg
            className="w-10 h-10 text-accent-green"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
        <h2 className="text-xl font-semibold text-primary mb-4">
          Page Not Found
        </h2>
        <p className="text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-6 py-3 bg-accent-green text-white font-medium rounded-xl hover:bg-accent-green/90 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

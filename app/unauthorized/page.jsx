'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
        <p className="text-xl text-gray-900 mb-8">Unauthorized Access</p>
        <p className="text-gray-9000 mb-8">You don&apos;t have permission to access this page.</p>
        <Link
          href="/login"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}


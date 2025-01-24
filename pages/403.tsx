import Head from 'next/head';
import Link from 'next/link';

export default function Forbidden() {
  return (
    <>
      <Head>
        <title>Access Denied</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">403</h1>
            <p className="mt-2 text-3xl font-bold text-gray-900">Access Denied</p>
            <p className="mt-2 text-sm text-gray-600">
              Sorry, you don't have permission to access this page.
            </p>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function VerifyEmail() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Verify Your Email - Zendesk</title>
      </Head>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-blue-500 dark:text-blue-400">
            <Mail className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We've sent you an email with a link to verify your account.
            Please check your inbox and click the link to continue.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => router.push('/auth/signin')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to sign in
          </button>
        </div>

        <div className="text-center text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Didn't receive the email?{' '}
            <button
              onClick={() => router.push('/auth/signup')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Try signing up again
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
} 
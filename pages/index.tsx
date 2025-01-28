import { motion } from 'framer-motion';
import { Building, HelpCircle, UserPlus } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const UserTypeCard = ({ title, description, onClick, icon: Icon }: {
  title: string;
  description: string;
  onClick: () => void;
  icon: any;
}) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center border border-slate-200 dark:border-slate-700"
    onClick={onClick}
  >
    <div className="text-4xl mb-4 text-blue-500 dark:text-blue-400">
      <Icon className="w-12 h-12" />
    </div>
    <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400">{description}</p>
  </motion.div>
);

export default function LandingPage() {
  const router = useRouter();

  const handleUserTypeSelection = (type: 'customer' | 'agent' | 'admin') => {
    router.push(`/auth/signup?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Head>
        <title>Welcome to Zendesk - Choose Your Path</title>
        <meta name="description" content="Start your journey with Zendesk - Get support, join as an agent, or create your organization" />
      </Head>

      <div className="container mx-auto px-4 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome to Zendesk
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose how you'd like to get started with our platform
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
          <UserTypeCard
            title="I Have a Question"
            description="Get help from our support team and find answers to your questions"
              icon={HelpCircle}
            onClick={() => handleUserTypeSelection('customer')}
          />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
          <UserTypeCard
            title="I'm an Agent"
            description="Join your organization's support team and help customers"
              icon={UserPlus}
            onClick={() => handleUserTypeSelection('agent')}
          />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
          <UserTypeCard
            title="Start an Organization"
            description="Create and manage your own support team"
              icon={Building}
            onClick={() => handleUserTypeSelection('admin')}
          />
          </motion.div>
        </div>
      </div>
    </div>
  );
} 
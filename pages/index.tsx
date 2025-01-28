import { motion } from 'framer-motion';
import Head from 'next/head';
import { useRouter } from 'next/router';

const UserTypeCard = ({ title, description, onClick, icon }: {
  title: string;
  description: string;
  onClick: () => void;
  icon: string;
}) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className="bg-white p-8 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center"
    onClick={onClick}
  >
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </motion.div>
);

export default function LandingPage() {
  const router = useRouter();

  const handleUserTypeSelection = (type: 'customer' | 'agent' | 'admin') => {
    router.push(`/auth/signup?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Head>
        <title>Welcome to Zendesk - Choose Your Path</title>
        <meta name="description" content="Start your journey with Zendesk" />
      </Head>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Welcome to Zendesk
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose how you'd like to get started with our platform
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <UserTypeCard
            title="I Have a Question"
            description="Get help from our support team and find answers to your questions"
            icon="❓"
            onClick={() => handleUserTypeSelection('customer')}
          />
          <UserTypeCard
            title="I'm an Agent"
            description="Join your organization's support team and help customers"
            icon="👨‍💼"
            onClick={() => handleUserTypeSelection('agent')}
          />
          <UserTypeCard
            title="Start an Organization"
            description="Create and manage your own support team"
            icon="🏢"
            onClick={() => handleUserTypeSelection('admin')}
          />
        </div>
      </div>
    </div>
  );
} 
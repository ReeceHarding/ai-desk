import { motion, type Variants } from 'framer-motion';
import { Building, HelpCircle, UserPlus } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const UserTypeCard = ({ title, description, onClick, icon: Icon }: {
  title: string;
  description: string;
  onClick: () => void;
  icon: any;
}) => {
  const variants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick();
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      onTap={onClick}
      style={{ 
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        border: '1px solid rgb(226, 232, 240)'
      }}
    >
      <div style={{ fontSize: '2.25rem', marginBottom: '1rem', color: 'rgb(59, 130, 246)' }}>
        <Icon style={{ width: '3rem', height: '3rem' }} />
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'rgb(15, 23, 42)' }}>{title}</h3>
      <p style={{ color: 'rgb(71, 85, 105)' }}>{description}</p>
    </motion.div>
  );
};

export default function LandingPage() {
  const router = useRouter();

  const handleUserTypeSelection = (type: 'customer' | 'agent' | 'admin') => {
    router.push(`/auth/signup?type=${type}`);
  };

  const containerVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, rgb(248, 250, 252), rgb(239, 246, 255))'
    }}>
      <Head>
        <title>Welcome to Zendesk - Choose Your Path</title>
        <meta name="description" content="Start your journey with Zendesk - Get support, join as an agent, or create your organization" />
      </Head>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem 1rem' }}>
        <motion.div 
          variants={containerVariants}
          initial="initial"
          animate="animate"
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <h1 style={{ 
            fontSize: '3rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            background: 'linear-gradient(to right, rgb(37, 99, 235), rgb(79, 70, 229))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Welcome to Zendesk
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'rgb(71, 85, 105)', maxWidth: '42rem', margin: '0 auto' }}>
            Choose how you'd like to get started with our platform
          </p>
        </motion.div>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2rem',
          maxWidth: '72rem',
          margin: '0 auto'
        }}>
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
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
            variants={containerVariants}
            initial="initial"
            animate="animate"
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
            variants={containerVariants}
            initial="initial"
            animate="animate"
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
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your DevCollab account to collaborate with your team on code reviews and projects.',
};

export default function LoginLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

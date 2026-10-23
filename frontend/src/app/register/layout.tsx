import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create an account to collaborate on code, manage Kanban boards, and review pull requests on DevCollab.',
};

export default function RegisterLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

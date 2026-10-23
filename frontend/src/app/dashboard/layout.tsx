import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Monitor your active software projects, open code reviews, and developer collaboration activity on DevCollab.',
};

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

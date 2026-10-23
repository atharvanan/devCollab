import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings',
  description: 'Manage your profile information, bio, GitHub connection, and account preferences.',
};

export default function SettingsLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

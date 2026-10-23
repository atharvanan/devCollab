import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Stay updated with your latest code review mentions, comments, and task updates.',
};

export default function NotificationsLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

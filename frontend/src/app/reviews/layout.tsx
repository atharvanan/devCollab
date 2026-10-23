import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Code Reviews',
  description: 'Conduct peer code reviews, line-by-line discussions, and approval workflows across projects.',
};

export default function ReviewsLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

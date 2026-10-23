import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Code Review Details',
  description: 'Inspect syntax-highlighted source code, comment on specific lines, and approve or request changes.',
};

export default function ReviewDetailLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

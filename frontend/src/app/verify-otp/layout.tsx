import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Enter your 6-digit one-time password code to verify your DevCollab account.',
};

export default function VerifyOTPLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

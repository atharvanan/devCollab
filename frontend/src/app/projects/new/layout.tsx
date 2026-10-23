import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Project',
  description: 'Create a new development project with team access and task management boards.',
};

export default function NewProjectLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

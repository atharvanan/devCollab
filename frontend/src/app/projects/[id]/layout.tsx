import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Details',
  description: 'View and manage tasks on the interactive Kanban board, track code reviews, and collaborate with project members.',
};

export default function ProjectDetailLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

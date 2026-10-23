import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Explore, manage, and collaborate on your team projects and Kanban boards.',
};

export default function ProjectsLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

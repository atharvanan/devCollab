import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
export type ColumnType = typeof COLUMNS[number];

export const COLUMN_LABELS: Record<ColumnType, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  changes_requested: 'bg-red-100 text-red-700',
  closed: 'bg-slate-100 text-slate-600',
};

export const ROLE_LABELS: Record<string, string> = {
  project_manager: 'Project Manager',
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  db_developer: 'Database Developer',
  devops: 'DevOps Engineer',
  cloud_admin: 'Cloud Admin',
  qa_tester: 'QA Tester',
  ui_ux_designer: 'UI/UX Designer',
  security_engineer: 'Security Engineer',
  admin: 'Admin',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

export const ROLE_COLORS: Record<string, string> = {
  project_manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  frontend_developer: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  backend_developer: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  db_developer: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  devops: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  cloud_admin: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  qa_tester: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  ui_ux_designer: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  security_engineer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  contributor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export const ROLE_OPTIONS = [
  { value: 'project_manager', label: 'Project Manager (Lead / Approver)' },
  { value: 'frontend_developer', label: 'Frontend Developer (UI/Web/App)' },
  { value: 'backend_developer', label: 'Backend Developer (APIs/Services)' },
  { value: 'db_developer', label: 'Database Developer (DBA/Schemas)' },
  { value: 'devops', label: 'DevOps Engineer (CI/CD/Docker)' },
  { value: 'cloud_admin', label: 'Cloud Admin (AWS/GCP/Infra)' },
  { value: 'qa_tester', label: 'QA Tester (Testing/E2E/Quality)' },
  { value: 'ui_ux_designer', label: 'UI/UX Designer (Design/Assets)' },
  { value: 'security_engineer', label: 'Security Engineer (Compliance/Audit)' },
  { value: 'contributor', label: 'General Contributor' },
  { value: 'viewer', label: 'Viewer (Read Only)' },
];

export const DOMAINS: Record<string, string> = {
  general: 'General / Multi-domain',
  frontend: 'Frontend (UI/Web)',
  backend: 'Backend (APIs/Services)',
  database: 'Database (Schemas/Migrations)',
  devops_cloud: 'DevOps & Cloud (Infra/CI/CD)',
  qa: 'QA & Testing',
  security: 'Security & Compliance',
};

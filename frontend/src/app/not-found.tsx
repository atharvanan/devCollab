import Link from 'next/link';
import { Code2, ArrowLeft, Home, FolderKanban } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found on DevCollab.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full space-y-6">
        {/* Clickable Logo */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 group transition-transform hover:scale-105 mx-auto"
        >
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">DevCollab</span>
        </Link>

        {/* 404 Visual badge */}
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full border border-primary/20">
            Error 404
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          <Link
            href="/projects"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-border bg-card hover:bg-accent text-foreground transition-colors"
          >
            <FolderKanban className="w-4 h-4" /> Browse Projects
          </Link>
        </div>
      </div>
    </div>
  );
}

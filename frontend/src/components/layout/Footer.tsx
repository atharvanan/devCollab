'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Code2, Mail, Github, ShieldCheck, Heart, X } from 'lucide-react';

export function Footer() {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="border-t border-border bg-card/50 mt-12 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Logo and brief info */}
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 font-bold text-base text-foreground hover:opacity-90 transition-opacity"
            >
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <span>DevCollab</span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-sm">
              Real-time code review, interactive Kanban boards, and developer workflow automation.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            <Link href="/dashboard" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/projects" className="hover:text-primary transition-colors">
              Projects
            </Link>
            <Link href="/reviews" className="hover:text-primary transition-colors">
              Reviews
            </Link>
            <Link href="/notifications" className="hover:text-primary transition-colors">
              Notifications
            </Link>
            <Link href="/settings" className="hover:text-primary transition-colors">
              Settings
            </Link>
          </div>

          {/* Contact Email */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a
              href="mailto:support@devcollab.io"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              title="Email DevCollab Support"
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span>support@devcollab.io</span>
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">All systems normal</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLegalModal('privacy')}
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setLegalModal('terms')}
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>

          <p>© {new Date().getFullYear()} DevCollab Inc. All rights reserved.</p>
        </div>
      </footer>

      {/* Legal & Terms Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    DevCollab values your privacy. We process source code, review metadata, and comments solely
                    to deliver real-time collaboration features to authorized team members within your organization.
                  </p>
                  <p>
                    Your source snippets are encrypted both in transit (TLS 1.3) and at rest. We never use your code
                    to train machine learning models without your explicit consent.
                  </p>
                  <p>
                    If you have questions about our data retention or security safeguards, reach out anytime to{' '}
                    <a href="mailto:support@devcollab.io" className="text-primary underline">support@devcollab.io</a>.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    By accessing or using DevCollab, you agree to comply with our terms of service and acceptable
                    use guidelines for developer collaboration and code review tools.
                  </p>
                  <p>
                    You are responsible for safeguarding your account credentials, one-time passwords, and API
                    tokens, as well as maintaining proper authorization for any code pushed to our platform.
                  </p>
                  <p>
                    For enterprise agreements, customized SLA inquiries, or dedicated deployment support,
                    please contact <a href="mailto:support@devcollab.io" className="text-primary underline">support@devcollab.io</a>.
                  </p>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

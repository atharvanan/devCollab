'use client';
import { useMemo } from 'react';
import { CONTRIBUTOR_COLORS, cn } from '@/lib/utils';

export interface Contributor {
  user: string | { _id: string; name: string; avatar?: string; email?: string };
  name: string;
  avatar?: string;
  role?: string;
  charactersAdded: number;
  linesContributed?: number;
  percentage: number;
  lastActive?: string | Date;
}

interface Props {
  contributors: Contributor[];
  activeUserIds: string[];
  totalLines: number;
  totalChars: number;
}

export function ShareMetrics({ contributors = [], activeUserIds = [], totalLines, totalChars }: Props) {
  const sortedContributors = useMemo(() => {
    return [...contributors].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  }, [contributors]);

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2.5 space-y-2 text-xs">
      {/* Compact Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-xs">Contribution Share</span>
          <span className="text-muted-foreground/60">•</span>
          <div className="flex items-center gap-3">
            {sortedContributors.slice(0, 4).map((c, idx) => {
              const color = CONTRIBUTOR_COLORS[idx % CONTRIBUTOR_COLORS.length];
              return (
                <div key={idx} className="inline-flex items-center gap-1.5 text-xs">
                  <span className={cn('w-2 h-2 rounded-full', color.bg)} />
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px] font-semibold">
                    {c.percentage || 0}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <span>
            <strong className="text-foreground">{totalLines}</strong> lines
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span>
            <strong className="text-foreground">{totalChars}</strong> chars
          </span>
        </div>
      </div>

      {/* Sleek GitHub-style Segmented Progress Bar */}
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
        {sortedContributors.length === 0 ? (
          <div className="h-full w-full bg-muted-foreground/20" />
        ) : (
          sortedContributors.map((c, idx) => {
            const color = CONTRIBUTOR_COLORS[idx % CONTRIBUTOR_COLORS.length];
            const pct = Math.max(0, c.percentage || 0);
            if (pct === 0) return null;
            return (
              <div
                key={idx}
                style={{ width: `${pct}%` }}
                title={`${c.name}: ${pct}% contribution`}
                className={cn('h-full transition-all duration-300', color.bg)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}


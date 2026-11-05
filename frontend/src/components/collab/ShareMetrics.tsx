'use client';
import { useMemo } from 'react';
import { Code, Activity, PieChart } from 'lucide-react';
import { Avatar } from '@/components/ui/Card';
import { CONTRIBUTOR_COLORS, ROLE_LABELS, ROLE_COLORS, cn } from '@/lib/utils';

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
    <div className="rounded-xs border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xs bg-primary/10 flex items-center justify-center text-primary">
            <PieChart className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Contribution Share</h3>
            <p className="text-[11px] text-muted-foreground">Real-time team authorship breakdown</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-mono">
            <Code className="w-3.5 h-3.5 text-primary" />
            <strong className="text-foreground">{totalLines}</strong> lines
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <strong className="text-foreground">{totalChars}</strong> chars
          </span>
        </div>
      </div>

      {/* Multi-segment Share Bar */}
      <div className="space-y-1.5">
        <div className="h-2.5 w-full bg-secondary/80 rounded-xs overflow-hidden flex shadow-inner">
          {sortedContributors.length === 0 ? (
            <div className="h-full w-full bg-muted-foreground/20 animate-pulse" />
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
                  className={cn('h-full transition-all duration-300 relative group', color.bg)}
                />
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {sortedContributors.map((c, idx) => {
            const color = CONTRIBUTOR_COLORS[idx % CONTRIBUTOR_COLORS.length];
            const uid = typeof c.user === 'object' ? c.user._id : c.user;
            const isOnline = activeUserIds.includes(uid);

            return (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                <span className={cn('w-2 h-2 rounded-xs', color.bg)} />
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="font-mono text-muted-foreground text-[11px] font-semibold">
                  {c.percentage || 0}%
                </span>
                {isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live ml-0.5" title="Online now" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Contributor Detail Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
        {sortedContributors.map((c, idx) => {
          const color = CONTRIBUTOR_COLORS[idx % CONTRIBUTOR_COLORS.length];
          const uid = typeof c.user === 'object' ? c.user._id : c.user;
          const isOnline = activeUserIds.includes(uid);
          const roleLabel = ROLE_LABELS[c.role || ''] || 'Contributor';

          return (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded-xs border border-border bg-accent/15 hover:bg-accent/30 transition-colors"
            >
              <div className="relative shrink-0">
                <Avatar src={c.avatar} name={c.name} size={30} />
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-card" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs',
                      color.light,
                      color.text
                    )}
                  >
                    {c.percentage || 0}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">{roleLabel}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    +{c.charactersAdded || 0} chars
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

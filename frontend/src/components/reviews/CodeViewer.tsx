'use client';
import { MessageSquare, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  code: string;
  language: string;
  activeLine: number | null;
  setActiveLine: (line: number | null) => void;
  commentsForLine: (line: number) => any[];
}

export function CodeViewer({ code, language, activeLine, setActiveLine, commentsForLine }: Props) {
  const lines = code.split('\n');

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-[#1e1e2e] text-[#cdd6f4] shadow-md max-w-full min-w-0">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-[#313244] text-xs text-[#a6adc8]">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono uppercase font-semibold text-[11px] tracking-wider text-[#cdd6f4]">
            {language || 'text'}
          </span>
        </div>
        <span className="text-[11px] text-[#6c7086]">{lines.length} lines</span>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto font-mono text-xs sm:text-sm max-w-full min-w-0 scrollbar-thin">
        {lines.map((line, idx) => {
          const lineNumber = idx + 1;
          const comments = commentsForLine(lineNumber);
          const isActive = activeLine === lineNumber;

          return (
            <div
              key={idx}
              className={cn(
                'flex group code-line min-w-0 w-full hover:bg-white/[0.03] transition-colors',
                isActive && 'highlighted bg-primary/15'
              )}
            >
              <button
                type="button"
                onClick={() => setActiveLine(isActive ? null : lineNumber)}
                title={`Click to comment on line ${lineNumber}`}
                className={cn(
                  'shrink-0 w-11 sm:w-14 text-right pr-2 sm:pr-3 py-0.5 text-[#6c7086] select-none inline-comment-indicator flex items-center justify-end gap-1 font-mono text-[11px] sm:text-xs border-r border-[#313244]/50',
                  comments.length > 0 && 'text-primary font-bold bg-primary/10'
                )}
              >
                {comments.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                    <span className="text-[10px]">{comments.length}</span>
                  </span>
                )}
                {lineNumber}
              </button>
              <pre className="flex-1 py-0.5 px-3 whitespace-pre overflow-x-auto min-w-0 text-xs sm:text-sm">
                {line || ' '}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

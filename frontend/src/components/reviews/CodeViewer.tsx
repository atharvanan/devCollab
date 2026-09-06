'use client';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  code: string;
  language: string;
  activeLine: number | null;
  setActiveLine: (line: number | null) => void;
  commentsForLine: (line: number) => any[];
}

export function CodeViewer({ code, activeLine, setActiveLine, commentsForLine }: Props) {
  const lines = code.split('\n');

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-[#1e1e2e] text-[#cdd6f4]">
      <div className="overflow-x-auto font-mono text-sm">
        {lines.map((line, idx) => {
          const lineNumber = idx + 1;
          const comments = commentsForLine(lineNumber);
          const isActive = activeLine === lineNumber;

          return (
            <div
              key={idx}
              className={cn(
                'flex group code-line',
                isActive && 'highlighted bg-primary/10'
              )}
            >
              <button
                onClick={() => setActiveLine(isActive ? null : lineNumber)}
                className={cn(
                  'shrink-0 w-12 text-right pr-3 py-0.5 text-[#6c7086] select-none inline-comment-indicator flex items-center justify-end gap-1',
                  comments.length > 0 && 'text-primary font-semibold'
                )}
              >
                {comments.length > 0 && <MessageSquare className="w-3 h-3" />}
                {lineNumber}
              </button>
              <pre className="flex-1 py-0.5 px-2 whitespace-pre overflow-x-auto">{line || ' '}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

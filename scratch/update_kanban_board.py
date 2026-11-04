with open('frontend/src/components/board/KanbanBoard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add SLA imports and state
old_imports = """import { COLUMNS, COLUMN_LABELS } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';"""

new_imports = """import { COLUMNS, COLUMN_LABELS } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useRef, useState } from 'react';"""

if old_imports in code:
    code = code.replace(old_imports, new_imports)
    print("KanbanBoard imports updated")
else:
    print("WARNING: old_imports not matched")

# 2. Update useQuery to capture slaSummary
old_query = """  useQuery(
    ['board', projectId],
    async () => {
      const res = await apiClient.get(`/board/${projectId}`);
      return res.data.data.board;
    },
    {
      onSuccess: (data) => dispatch(boardActions.setBoard(data)),
    }
  );"""

new_query = """  const [slaMetrics, setSlaMetrics] = useState<any>(null);

  useQuery(
    ['board', projectId],
    async () => {
      const res = await apiClient.get(`/board/${projectId}`);
      return res.data.data;
    },
    {
      onSuccess: (data) => {
        dispatch(boardActions.setBoard(data.board));
        if (data.slaSummary) {
          setSlaMetrics(data.slaSummary);
        }
      },
    }
  );"""

if old_query in code:
    code = code.replace(old_query, new_query)
    print("KanbanBoard useQuery updated")
else:
    print("WARNING: old_query not matched")

# 3. Update handleDragEnd to enforce strict role hierarchy
old_drag_end = """    if (!fromColumn || !toColumn) return;

    const newOrder = columns[toColumn]?.length || 0;
    dispatch(boardActions.moveTask({ taskId, from: fromColumn, to: toColumn, order: newOrder }));
    moveMutation.mutate({ taskId, column: toColumn, order: newOrder });
  };"""

new_drag_end = """    if (!fromColumn || !toColumn) return;

    const taskToMove = (columns[fromColumn] || []).find((t) => t._id === taskId);
    if (!taskToMove) return;

    const isAssignee = taskToMove.assignees?.some(
      (a: any) => (a._id || a).toString() === user?._id?.toString()
    );

    // Compliance Check 1: Non-PM cannot move directly into Done
    if (toColumn === 'done' && !isPM) {
      toast.error('Compliance Restriction: Only Project Managers can approve and close tickets into Done.');
      return;
    }

    // Compliance Check 2: Non-PM cannot drag tickets out of Review
    if (fromColumn === 'review' && toColumn !== 'review' && !isPM) {
      toast.error('Compliance Restriction: Ticket is locked under PM Review. Only Project Managers can approve or request revisions.');
      return;
    }

    // Compliance Check 3: Non-PM cannot move other members' tickets
    if (!isPM && !isAssignee) {
      toast.error('Permission Denied: Only assigned engineers or Project Managers can move this ticket.');
      return;
    }

    const newOrder = columns[toColumn]?.length || 0;
    dispatch(boardActions.moveTask({ taskId, from: fromColumn, to: toColumn, order: newOrder }));
    moveMutation.mutate({ taskId, column: toColumn, order: newOrder });
  };"""

if old_drag_end in code:
    code = code.replace(old_drag_end, new_drag_end)
    print("KanbanBoard handleDragEnd updated with compliance hierarchy")
else:
    print("WARNING: old_drag_end not matched")

# 4. Add SLA & Compliance Banner above board columns
old_banner_header = """      {/* Quick horizontal board navigation helper */}
      <div className="flex items-center justify-between pb-2 px-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          Workflow Columns
        </span>"""

new_banner_header = """      {/* Enterprise SLA & SDLC Compliance Bar */}
      <div className="mb-3 p-2.5 sm:p-3 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>SLA Health:</span>
            <span className="text-primary font-mono">{slaMetrics?.complianceRate ?? 100}% Met</span>
          </div>

          <div className="h-3 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> {slaMetrics?.compliant ?? 0} Compliant
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" /> {slaMetrics?.atRisk ?? 0} At Risk
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3 h-3" /> {slaMetrics?.breached ?? 0} Breached
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-md border border-border/50">
            <Lock className="w-3 h-3 text-amber-500" />
            {isPM ? 'PM Authority: Full Sign-Off Active' : 'Strict Hierarchy: PM Sign-Off Required for Done'}
          </span>
        </div>
      </div>

      {/* Quick horizontal board navigation helper */}
      <div className="flex items-center justify-between pb-2 px-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          Workflow Columns
        </span>"""

if old_banner_header in code:
    code = code.replace(old_banner_header, new_banner_header)
    print("KanbanBoard SLA & Compliance banner added")
else:
    print("WARNING: old_banner_header not matched")

with open('frontend/src/components/board/KanbanBoard.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(code)
print("Saved KanbanBoard.tsx successfully")


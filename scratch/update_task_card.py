with open('frontend/src/components/board/TaskCard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
old_imports = "import { Calendar, CheckSquare, Square, ShieldAlert, CheckCircle2, RotateCcw, MessageSquare, Maximize2 } from 'lucide-react';"
new_imports = "import { Calendar, CheckSquare, Square, ShieldAlert, CheckCircle2, RotateCcw, MessageSquare, Maximize2, Clock, Lock } from 'lucide-react';"

if old_imports in code:
    code = code.replace(old_imports, new_imports)
    print("TaskCard imports updated")
else:
    print("WARNING: old_imports not matched")

# 2. Update useSortable with disabled prop
old_sortable = """  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isAssignee = task.assignees?.some(
    (a: any) => (a._id || a).toString() === currentUserId?.toString()
  );
  const canToggleDone = isAssignee || isPM;"""

new_sortable = """  const isAssignee = task.assignees?.some(
    (a: any) => (a._id || a).toString() === currentUserId?.toString()
  );
  const canToggleDone = isAssignee || isPM;
  const isDragDisabled = !isPM && (task.column === 'review' || !isAssignee);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragDisabled ? 'default' : 'grab',
  };"""

if old_sortable in code:
    code = code.replace(old_sortable, new_sortable)
    print("TaskCard sortable updated with role hierarchy drag-lock")
else:
    print("WARNING: old_sortable not matched")

# 3. Add SLA Badge under priority
old_badges = """        {/* Role & Priority Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase rounded px-1.5 py-0.5',
              PRIORITY_COLORS[task.priority]
            )}
          >
            {task.priority}
          </span>

          {task.targetRole && task.targetRole !== 'any' && (
            <span
              className={cn(
                'text-[10px] font-medium rounded px-1.5 py-0.5 border',
                ROLE_COLORS[task.targetRole] || 'bg-secondary text-secondary-foreground'
              )}
            >
              {ROLE_LABELS[task.targetRole] || task.targetRole}
            </span>
          )}
        </div>"""

new_badges = """        {/* Role & Priority Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase rounded px-1.5 py-0.5',
              PRIORITY_COLORS[task.priority]
            )}
          >
            {task.priority}
          </span>

          {task.targetRole && task.targetRole !== 'any' && (
            <span
              className={cn(
                'text-[10px] font-medium rounded px-1.5 py-0.5 border',
                ROLE_COLORS[task.targetRole] || 'bg-secondary text-secondary-foreground'
              )}
            >
              {ROLE_LABELS[task.targetRole] || task.targetRole}
            </span>
          )}

          {/* Under Review Lock Tag for Team Members */}
          {task.column === 'review' && !isPM && (
            <span
              className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"
              title="Ticket is locked pending Project Manager review"
            >
              <Lock className="w-2.5 h-2.5" /> PM Review
            </span>
          )}
        </div>

        {/* Real-Time Enterprise SLA Badge */}
        {task.slaStatus && (
          <div className="pt-0.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border tracking-tight',
                task.slaStatus.state === 'breached' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse',
                task.slaStatus.state === 'at_risk' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                task.slaStatus.state === 'fulfilled' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                task.slaStatus.state === 'healthy' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
              )}
              title={`SLA Target: ${task.slaStatus.policy?.label || task.priority}. ${task.slaStatus.label}`}
            >
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span>{task.slaStatus.label}</span>
            </span>
          </div>
        )}"""

if old_badges in code:
    code = code.replace(old_badges, new_badges)
    print("TaskCard SLA Badge and Review Lock tag added")
else:
    print("WARNING: old_badges not matched")

with open('frontend/src/components/board/TaskCard.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(code)
print("Saved TaskCard.tsx successfully")


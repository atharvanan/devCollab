with open('frontend/src/components/board/TaskDetailModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Ensure Lock and AlertTriangle in imports
old_imp = "  FileText,\n} from 'lucide-react';"
new_imp = "  FileText,\n  Lock,\n  AlertTriangle,\n} from 'lucide-react';"

if old_imp in code:
    code = code.replace(old_imp, new_imp)
    print("Imports updated in TaskDetailModal")
else:
    print("WARNING: old_imp not matched")

# 2. Add SLA Panel right below People & Dates Metadata Grid
old_metadata_grid_end = """            {/* Due Date */}
            {task.dueDate && (
              <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-2.5 text-muted-foreground sm:col-span-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Due Date: <strong className="text-foreground">{formatDate(task.dueDate)}</strong>
                </span>
              </div>
            )}
          </div>"""

new_metadata_grid_end = """            {/* Due Date */}
            {task.dueDate && (
              <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-2.5 text-muted-foreground sm:col-span-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Due Date: <strong className="text-foreground">{formatDate(task.dueDate)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Enterprise SLA Audit & Compliance Panel */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> Enterprise SLA & Compliance Audit
              </h3>
              {task.slaStatus && (
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded border',
                    task.slaStatus.state === 'breached' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                    task.slaStatus.state === 'at_risk' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    task.slaStatus.state === 'fulfilled' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                    task.slaStatus.state === 'healthy' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                  )}
                >
                  {task.slaStatus.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Response SLA */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  1. Response SLA (Time to In Progress)
                </span>
                <p className="text-foreground font-medium">
                  {task.startedAt ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Started {formatRelativeTime(task.startedAt)}
                    </span>
                  ) : task.sla?.responseDeadline ? (
                    new Date() > new Date(task.sla.responseDeadline) ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Response Breached (Overdue)
                      </span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Due by {formatDate(task.sla.responseDeadline)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Within standard SLA window</span>
                  )}
                </p>
              </div>

              {/* Resolution SLA */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  2. Resolution SLA (Time to PM Done)
                </span>
                <p className="text-foreground font-medium">
                  {task.column === 'done' ? (
                    task.sla?.resolutionBreached ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Closed Post-Breach
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved within SLA
                      </span>
                    )
                  ) : task.sla?.resolutionDeadline ? (
                    new Date() > new Date(task.sla.resolutionDeadline) ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> SLA Breached
                      </span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Due by {formatDate(task.sla.resolutionDeadline)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Active in lifecycle</span>
                  )}
                </p>
              </div>
            </div>

            {/* Hierarchy Compliance Notice */}
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                <strong>SOC-2 SDLC Rule:</strong> Only the Project Manager can sign off and close open tickets into Done after reviewing submitted work.
              </span>
            </div>
          </div>"""

if old_metadata_grid_end in code:
    code = code.replace(old_metadata_grid_end, new_metadata_grid_end)
    print("Enterprise SLA Panel added to TaskDetailModal")
else:
    print("WARNING: old_metadata_grid_end not matched")

with open('frontend/src/components/board/TaskDetailModal.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(code)
print("Saved TaskDetailModal.tsx successfully")


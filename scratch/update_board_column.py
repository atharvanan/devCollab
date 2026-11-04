with open('frontend/src/components/board/BoardColumn.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "import { Plus } from 'lucide-react';",
    "import { Plus, Lock } from 'lucide-react';"
)

old_header = """          <span className="text-[11px] font-mono text-muted-foreground bg-secondary/80 border border-border/50 font-semibold rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </h3>"""

new_header = """          <span className="text-[11px] font-mono text-muted-foreground bg-secondary/80 border border-border/50 font-semibold rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
          {id === 'done' && !isPM && (
            <span
              className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"
              title="Compliance Rule: Only Project Managers can approve and close tickets into Done"
            >
              <Lock className="w-2.5 h-2.5" /> PM Only
            </span>
          )}
        </h3>"""

if old_header in c:
    c = c.replace(old_header, new_header)
    with open('frontend/src/components/board/BoardColumn.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(c)
    print("BoardColumn.tsx updated with PM Only lock badge")
else:
    print("WARNING: old_header not matched")


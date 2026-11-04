with open('frontend/src/components/layout/Sidebar.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_c = """        <button
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className="flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >"""

new_c = """        <button
          type="button"
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className="flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer active:scale-95"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >"""

if old_c in c:
    c = c.replace(old_c, new_c)
    with open('frontend/src/components/layout/Sidebar.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(c)
    print('UPDATED SIDEBAR COLLAPSE BUTTON')
else:
    print('NOT FOUND')


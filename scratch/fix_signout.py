import re

# 1. Update Sidebar.tsx
with open('frontend/src/components/layout/Sidebar.tsx', 'r', encoding='utf-8') as f:
    sidebar = f.read()

sidebar = sidebar.replace(
    "import { logoutUser } from '@/store/slices/authSlice';",
    "import { logoutUser, performImmediateLogout } from '@/store/slices/authSlice';"
)

old_sidebar_btn = """        <button
          onClick={() => dispatch(logoutUser())}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>"""

new_sidebar_btn = """        <button
          type="button"
          onClick={() => performImmediateLogout(dispatch)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group cursor-pointer active:scale-95"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>"""

if old_sidebar_btn in sidebar:
    sidebar = sidebar.replace(old_sidebar_btn, new_sidebar_btn)
    with open('frontend/src/components/layout/Sidebar.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(sidebar)
    print("Sidebar.tsx updated successfully.")
else:
    print("WARNING: Sidebar button not matched!")

# 2. Update MobileNav.tsx
with open('frontend/src/components/layout/MobileNav.tsx', 'r', encoding='utf-8') as f:
    mobilenav = f.read()

mobilenav = mobilenav.replace(
    "import { logoutUser } from '@/store/slices/authSlice';",
    "import { logoutUser, performImmediateLogout } from '@/store/slices/authSlice';"
)

old_mobile_btn = """              <button
                onClick={() => {
                  setIsOpen(false);
                  dispatch(logoutUser());
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>"""

new_mobile_btn = """              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  performImmediateLogout(dispatch);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer active:scale-95"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>"""

if old_mobile_btn in mobilenav:
    mobilenav = mobilenav.replace(old_mobile_btn, new_mobile_btn)
    with open('frontend/src/components/layout/MobileNav.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(mobilenav)
    print("MobileNav.tsx updated successfully.")
else:
    print("WARNING: MobileNav button not matched!")

# 3. Update DashboardLayout.tsx to enforce auth redirect when unauthenticated
with open('frontend/src/components/layout/DashboardLayout.tsx', 'r', encoding='utf-8') as f:
    dashboard = f.read()

old_dash = """export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);"""

new_dash = """import { useEffect } from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const { user, accessToken, initialized } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (initialized && !user && !accessToken) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [initialized, user, accessToken]);"""

if old_dash in dashboard:
    dashboard = dashboard.replace(old_dash, new_dash)
    with open('frontend/src/components/layout/DashboardLayout.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(dashboard)
    print("DashboardLayout.tsx updated successfully.")
else:
    print("WARNING: DashboardLayout not matched!")


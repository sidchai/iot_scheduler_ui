import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ListTodo,
  Activity,
  Bell,
  Send,
  Server,
  Users,
  FileText,
  ShieldCheck,
  CalendarClock,
  BookOpen,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: '主控制台',
    items: [
      { to: '/', label: '概览', icon: LayoutDashboard, exact: true },
      { to: '/apps', label: '应用管理', icon: Boxes },
      { to: '/jobs', label: '任务管理', icon: ListTodo },
      { to: '/runs', label: '执行记录', icon: Activity },
    ],
  },
  {
    title: '运维',
    items: [
      { to: '/alerts/rules', label: '告警规则', icon: Bell },
      { to: '/alerts/channels', label: '通知渠道', icon: Send },
      { to: '/workers', label: 'Worker 节点', icon: Server },
    ],
  },
  {
    title: '系统',
    items: [
      { to: '/users', label: '用户管理', icon: Users },
      { to: '/pending-changes', label: '双人复核', icon: ShieldCheck },
      { to: '/audit', label: '审计日志', icon: FileText },
    ],
  },
];

function getBreadcrumb(path: string): string {
  for (const g of navGroups) {
    for (const it of g.items) {
      if (it.exact ? path === it.to : path.startsWith(it.to) && it.to !== '/') {
        return it.label;
      }
    }
  }
  if (path.startsWith('/alerts/bindings')) return '告警绑定';
  if (path.startsWith('/alerts/events')) return '告警事件';
  return '控制台';
}

function userInitials(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(0, 2);
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.display_name || user?.username || 'unknown';
  const role = user?.role?.replace('USER_ROLE_', '').toLowerCase() || '';

  return (
    <div className="flex h-full overflow-hidden bg-bg text-fg">
      {/* 侧边栏 */}
      <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border bg-bg-elevated">
        {/* Logo */}
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <CalendarClock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[14px] font-semibold leading-tight text-fg">iot-scheduler</div>
              <div className="mt-0.5 text-[11px] leading-tight text-fg-subtle">
                v0.1.0 · 控制台
              </div>
            </div>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="border-b border-border px-3 py-3">
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-bg-muted px-3 text-left text-[13px] text-fg-subtle transition hover:border-border-strong hover:bg-card-hover"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              搜索...
            </span>
            <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* 导航分组 */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navGroups.map((g, idx) => (
            <div key={g.title}>
              <div
                className={cn(
                  'px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle',
                  idx === 0 ? 'pt-1' : 'pt-6',
                )}
              >
                {g.title}
              </div>
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => cn('nav-item', isActive && 'active')}
                  >
                    <Icon />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 底部用户卡 */}
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-[12px] font-semibold text-white">
              {userInitials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight text-fg">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-[11px] leading-tight text-fg-subtle">
                {role && <span className="capitalize">{role}</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto bg-bg">
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold text-fg">{getBreadcrumb(location.pathname)}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-fg-muted transition hover:bg-bg-muted hover:text-fg" type="button">
              <BookOpen className="h-4 w-4" />
              文档
            </button>
            <div className="h-5 w-px bg-border" />
            <span className="ui-badge ui-badge-success">
              <span
                className="ui-dot ui-dot-success"
                style={{ width: 6, height: 6, boxShadow: 'none' }}
              />
              Production
            </span>
            <button
              type="button"
              className="relative rounded-lg p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="relative rounded-lg p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
              aria-label="通知"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
            </button>
          </div>
        </header>

        {/* 路由出口 */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

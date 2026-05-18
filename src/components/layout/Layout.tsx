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
  ChevronUp,
  Search,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

/**
 * 主布局：左侧固定侧边栏 + 顶部 sticky bar + 内容区。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html 原型：
 *   - 侧边栏 232px，分三组（主控制台/运维/系统）
 *   - 顶部 bar 含 breadcrumb（按路由动态生成）、文档入口、env 徽章、消息铃铛
 *   - 底部用户卡：头像 + 用户名 + 角色，点击退出登录
 *   - .nav-item 类来自 index.css（@layer components），跟原型 1:1
 *
 * 路由层用 <Outlet /> 渲染当前页；ProtectedRoute 已在 router 层拦截未登录用户。
 */

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

// 导航分组：与原型 L274-L287 完全对齐
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

// 把当前 path 映射为 breadcrumb 文本（与导航 label 同步）
function getBreadcrumb(path: string): string {
  for (const g of navGroups) {
    for (const it of g.items) {
      if (it.exact ? path === it.to : path.startsWith(it.to) && it.to !== '/') {
        return it.label;
      }
    }
  }
  // 兼容已存在但不在分组里的旧路由
  if (path.startsWith('/alerts/bindings')) return '告警绑定';
  if (path.startsWith('/alerts/events')) return '告警事件';
  return '控制台';
}

// 从 display_name 取首字母（中文取前 2 字符；英文取首位）作为头像 fallback
function userInitials(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  // 包含中日韩字符 → 取头 2 个
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(0, 2);
  // 否则按空格切，取每段首字母
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

  // 退出登录：清 store + 跳 /login，replace 避免后退回到老页
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.display_name || user?.username || 'unknown';
  const role = user?.role?.replace('USER_ROLE_', '').toLowerCase() || '';
  const provider = user?.sso_provider ? `${user.sso_provider}/${user.sso_subject || '-'}` : '';

  return (
    <div className="flex h-full overflow-hidden bg-bg text-fg">
      {/* ========== 侧边栏 ========== */}
      <aside className="flex w-[232px] flex-shrink-0 flex-col border-r border-border bg-white">
        {/* Logo */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-[14px] font-semibold leading-tight">iot-scheduler</div>
              <div className="mt-0.5 text-[11px] leading-tight text-fg-subtle">
                v0.1.0 · 控制台
              </div>
            </div>
          </div>
        </div>

        {/* 全局搜索占位：先对齐 RFC-05 原型的信息架构，快捷键逻辑后续接入命令面板。 */}
        <div className="border-b border-border px-2 py-3">
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-3 text-left text-[13px] text-fg-subtle transition hover:border-border-strong hover:bg-hover"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              搜索任务 / 应用...
            </span>
            <kbd className="rounded border border-border bg-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* 导航分组 */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navGroups.map((g, idx) => (
            <div key={g.title}>
              <div
                className={cn(
                  'px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle',
                  idx === 0 ? 'pt-2' : 'pt-4',
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
                    // nav-item 类 + active 修饰由 NavLink 的 className 函数控制
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
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition hover:bg-hover"
            title="点击退出登录"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[12px] font-semibold text-white">
              {userInitials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-[11px] leading-tight text-fg-subtle">
                {role && <span className="capitalize">{role}</span>}
                {role && provider && ' · '}
                {provider}
              </div>
            </div>
            <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-fg-subtle" />
          </button>
        </div>
      </aside>

      {/* ========== 主内容区 ========== */}
      <main className="flex-1 overflow-y-auto bg-bg">
        {/* 顶部 sticky bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-white/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            <span className="font-medium text-fg">{getBreadcrumb(location.pathname)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="ui-btn ui-btn-ghost ui-btn-sm text-[12px]" type="button">
              <BookOpen className="h-3.5 w-3.5" />
              文档
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="ui-badge ui-badge-success">
              <span
                className="ui-dot ui-dot-success"
                style={{ width: 6, height: 6, boxShadow: 'none' }}
              />
              dev
            </span>
            <button
              type="button"
              className="relative rounded-md p-1.5 text-fg-muted transition hover:bg-hover hover:text-fg"
              aria-label="通知"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>
          </div>
        </header>

        {/* 路由出口：所有页面在 p-8 容器里渲染（与原型对齐） */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

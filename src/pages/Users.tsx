import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, UserCog, Eye, UserPlus } from 'lucide-react';
import { userApi, extractError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { formatUnix } from '@/lib/utils';
import type { User, UserRole } from '@/types/api';

/**
 * 用户管理页（仅 admin 可见，普通用户访问后端会返回 403）。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html L1135-L1179：
 *   - 顶部 3 张 KPI 卡：admin / operator / viewer 数量
 *   - 表格：头像 + 用户名/邮箱 + 角色徽章 + SSO 主体 + 最近登录 + 操作
 *   - 操作：修改角色 / 邀请用户 / 禁用
 *
 * 实现细节：
 *   - 角色徽章颜色与原型对齐（admin=danger / operator=warning / viewer=default）
 *   - 头像取 display_name 首字母（中文取头 2 字符）
 *   - SSO 主体已脱敏（后端返回时只保留前后各 3 位）
 */
export default function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [disableTarget, setDisableTarget] = useState<User | null>(null);

  const q = useQuery({
    queryKey: ['users', keyword, page],
    queryFn: () =>
      userApi.list({
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const disableMu = useMutation({
    mutationFn: (id: number) => userApi.disable(id),
    onSuccess: (r, id) => {
      if (r.ok) {
        toast.success(`用户 #${id} 已禁用`);
        qc.invalidateQueries({ queryKey: ['users'] });
      } else {
        toast.error(r.error || '禁用失败');
      }
      setDisableTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  // 按角色聚合（用 q.data.users 因为分页接口的角色统计不准确，这里只展示当前页的）
  // 真实场景应由后端返回汇总数据；P0 简化为前端聚合
  const counts = useMemo(() => {
    const all = q.data?.users ?? [];
    return {
      admin: all.filter((u) => u.role === 'USER_ROLE_ADMIN').length,
      operator: all.filter((u) => u.role === 'USER_ROLE_OPERATOR').length,
      viewer: all.filter((u) => u.role === 'USER_ROLE_VIEWER').length,
    };
  }, [q.data]);

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">用户管理</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {total} 个用户 · 通过 SSO 单点登录
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          邀请用户
        </button>
      </div>

      {/* KPI 三张卡 */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <KpiCard
          label="管理员"
          icon={<Shield className="h-4 w-4 text-danger" />}
          value={counts.admin}
          hint="完整管理权限"
        />
        <KpiCard
          label="运维"
          icon={<UserCog className="h-4 w-4 text-warning" />}
          value={counts.operator}
          hint="可触发/暂停/取消"
        />
        <KpiCard
          label="只读"
          icon={<Eye className="h-4 w-4 text-fg-muted" />}
          value={counts.viewer}
          hint="仅查看"
        />
      </div>

      {/* 搜索 */}
      <div className="ui-card mb-4 overflow-hidden">
        <div className="border-b border-border p-4">
          <input
            className="ui-input"
            style={{ width: 320 }}
            placeholder="按用户名/邮箱搜索..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
          />
        </div>

        {q.isLoading ? (
          <Empty text="加载中…" />
        ) : q.error ? (
          <Empty text={extractError(q.error)} danger />
        ) : !q.data || q.data.users.length === 0 ? (
          <Empty text="没有匹配的用户" />
        ) : (
          <>
            <table className="ui-tbl">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>SSO 主体</th>
                  <th>最近登录</th>
                  <th className="pr-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {q.data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white ${avatarColor(u.username)}`}
                        >
                          {initials(u.display_name || u.username)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {u.display_name || u.username}
                            {!u.enabled && (
                              <span className="ml-2 text-[11px] text-fg-subtle">
                                (已禁用)
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-fg-muted">
                            {u.email || u.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td>
                      <code className="text-[12px] text-fg-muted">
                        {u.sso_provider ? `${u.sso_provider}/${u.sso_subject || '-'}` : '-'}
                      </code>
                    </td>
                    <td className="text-fg-muted">
                      {u.last_login_at ? formatUnix(u.last_login_at) : '从未登录'}
                    </td>
                    <td className="space-x-3 pr-4 text-right">
                      <button
                        type="button"
                        className="ui-link"
                        onClick={() => setRoleTarget(u)}
                      >
                        修改角色
                      </button>
                      {u.enabled && (
                        <button
                          type="button"
                          className="ui-link ui-link-danger"
                          onClick={() => setDisableTarget(u)}
                        >
                          禁用
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] text-fg-muted">
                <span>
                  共 {total} 条 · 第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="ui-btn ui-btn-default ui-btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn-default ui-btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 邀请用户对话框 */}
      {inviteOpen && (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })}
        />
      )}

      {/* 修改角色对话框 */}
      {roleTarget && (
        <RoleDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })}
        />
      )}

      {/* 禁用确认 */}
      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={(o) => !o && setDisableTarget(null)}
        title="禁用用户"
        description={
          disableTarget
            ? `禁用 ${disableTarget.display_name || disableTarget.username}？该用户将无法登录，但历史审计记录保留。`
            : ''
        }
        confirmText="禁用"
        variant="destructive"
        loading={disableMu.isPending}
        onConfirm={() => disableTarget && disableMu.mutate(disableTarget.id)}
      />
    </>
  );
}

// =====================================================================
// 子组件
// =====================================================================

function KpiCard({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  hint: string;
}) {
  return (
    <div className="ui-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-medium text-fg-muted">{label}</div>
        {icon}
      </div>
      <div className="text-[28px] font-semibold leading-none">{value}</div>
      <div className="mt-2 text-[12px] text-fg-muted">{hint}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const m: Record<UserRole, { cls: string; text: string }> = {
    USER_ROLE_UNSPECIFIED: { cls: 'ui-badge-default', text: '未知' },
    USER_ROLE_ADMIN: { cls: 'ui-badge-danger', text: '管理员' },
    USER_ROLE_OPERATOR: { cls: 'ui-badge-warning', text: '运维' },
    USER_ROLE_VIEWER: { cls: 'ui-badge-default', text: '只读' },
  };
  const cfg = m[role] || m.USER_ROLE_UNSPECIFIED;
  return <span className={`ui-badge ${cfg.cls}`}>{cfg.text}</span>;
}

function Empty({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div
      className={`px-4 py-12 text-center text-[13px] ${danger ? 'text-danger' : 'text-fg-muted'}`}
    >
      {text}
    </div>
  );
}

// 头像首字母：中文取前 2 字符，英文取每段首字母
function initials(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(0, 2);
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

// 头像背景色：按 username 字符串哈希映射到固定渐变（保证同一用户颜色稳定）
function avatarColor(username: string): string {
  const palette = [
    'bg-gradient-to-br from-blue-500 to-blue-700',
    'bg-gradient-to-br from-emerald-500 to-emerald-700',
    'bg-gradient-to-br from-sky-500 to-sky-700',
    'bg-gradient-to-br from-orange-500 to-orange-700',
    'bg-gradient-to-br from-rose-500 to-rose-700',
    'bg-gradient-to-br from-teal-500 to-teal-700',
    'bg-gradient-to-br from-zinc-400 to-zinc-600',
  ];
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// =====================================================================
// 邀请用户对话框
// =====================================================================
function InviteDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    email: '',
    role: 'USER_ROLE_VIEWER' as UserRole,
  });

  const mu = useMutation({
    mutationFn: () => userApi.invite(form),
    onSuccess: () => {
      toast.success(`已邀请 ${form.username}`);
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="邀请用户"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-default" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={mu.isPending || !form.username}
            onClick={() => mu.mutate()}
          >
            {mu.isPending ? '邀请中…' : '邀请'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="用户名" required>
          <input
            className="ui-input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="zhang.san"
          />
        </FormField>
        <FormField label="显示名">
          <input
            className="ui-input"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="张三"
          />
        </FormField>
        <FormField label="邮箱">
          <input
            className="ui-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="zhang.san@example.com"
          />
        </FormField>
        <FormField label="角色">
          <select
            className="ui-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            <option value="USER_ROLE_VIEWER">只读 · 仅查看</option>
            <option value="USER_ROLE_OPERATOR">运维 · 可触发/暂停</option>
            <option value="USER_ROLE_ADMIN">管理员 · 完整管理</option>
          </select>
        </FormField>
      </div>
    </Dialog>
  );
}

// =====================================================================
// 修改角色对话框
// =====================================================================
function RoleDialog({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<UserRole>(user.role);

  const mu = useMutation({
    mutationFn: () => userApi.updateRole(user.id, role),
    onSuccess: () => {
      toast.success(`${user.display_name || user.username} 角色已更新`);
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`修改 ${user.display_name || user.username} 的角色`}
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-default" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={mu.isPending || role === user.role}
            onClick={() => mu.mutate()}
          >
            {mu.isPending ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <FormField label="角色">
        <select
          className="ui-input"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="USER_ROLE_VIEWER">只读 · 仅查看</option>
          <option value="USER_ROLE_OPERATOR">运维 · 可触发/暂停</option>
          <option value="USER_ROLE_ADMIN">管理员 · 完整管理</option>
        </select>
      </FormField>
    </Dialog>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="ui-label">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

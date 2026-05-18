import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cloud, Cpu, Globe2, MoreHorizontal, Plus, Radio, Search } from 'lucide-react';
import { appApi, extractError, jobApi, workerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { AppForm, SecretDisplay } from '@/components/AppForm';
import { cn } from '@/lib/utils';
import type { App } from '@/types/api';

export default function AppsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<App | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null);
  const [disableTarget, setDisableTarget] = useState<App | null>(null);
  const [resetTarget, setResetTarget] = useState<App | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const apps = useQuery({
    queryKey: ['apps', keyword],
    queryFn: () => appApi.list(keyword || undefined),
  });

  const jobs = useQuery({
    queryKey: ['jobsForAppSummary'],
    queryFn: () => jobApi.list({ page: 1, page_size: 1000 }),
  });

  const workers = useQuery({
    queryKey: ['workersForAppSummary'],
    queryFn: () => workerApi.list(),
  });

  const jobCountByApp = useMemo(() => {
    return (jobs.data?.jobs ?? []).reduce<Record<string, number>>((acc, job) => {
      acc[job.app_name] = (acc[job.app_name] ?? 0) + 1;
      return acc;
    }, {});
  }, [jobs.data?.jobs]);

  const workerCountByApp = useMemo(() => {
    return (workers.data ?? []).reduce<Record<string, { online: number; total: number }>>(
      (acc, worker) => {
        const current = acc[worker.app_name] ?? { online: 0, total: 0 };
        acc[worker.app_name] = {
          online: current.online + (worker.status === 'online' ? 1 : 0),
          total: current.total + 1,
        };
        return acc;
      },
      {},
    );
  }, [workers.data]);

  const filteredApps = useMemo(() => {
    const list = apps.data ?? [];
    if (enabledFilter === 'enabled') return list.filter((app) => app.enabled);
    if (enabledFilter === 'disabled') return list.filter((app) => !app.enabled);
    return list;
  }, [apps.data, enabledFilter]);

  const deleteMutation = useMutation({
    mutationFn: (name: string) => appApi.remove(name),
    onSuccess: (res, name) => {
      if (!res.ok) {
        toast.error(res.error || '删除失败');
        return;
      }
      qc.invalidateQueries({ queryKey: ['apps'] });
      toast.success(`应用 ${name} 已删除`);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const disableMutation = useMutation({
    mutationFn: (name: string) => appApi.disable(name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      toast.success(`应用 ${name} 已禁用`);
      setDisableTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const resetMutation = useMutation({
    mutationFn: (name: string) => appApi.resetSecret(name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      setResetTarget(null);
      setNewSecret(data.app_secret);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (app: App) => {
    setEditing(app);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">应用管理</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            已注册的业务方应用 · 共 {apps.data?.length ?? 0} 个
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> 新建应用
        </Button>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索 appName..."
                className="ui-input pl-10"
              />
            </div>
            <select
              value={enabledFilter}
              onChange={(e) => setEnabledFilter(e.target.value)}
              className="ui-input w-36"
            >
              <option value="all">全部状态</option>
              <option value="enabled">启用</option>
              <option value="disabled">禁用</option>
            </select>
          </div>
          <span className="text-[12px] text-fg-muted">{filteredApps.length} 个应用</span>
        </div>

        {apps.isLoading && <div className="p-12 text-center text-[13px] text-fg-muted">加载中...</div>}
        {apps.isError && (
          <div className="p-12 text-center text-[13px] text-danger">加载失败：{extractError(apps.error)}</div>
        )}
        {apps.data && filteredApps.length === 0 && (
          <div className="p-12 text-center text-[13px] text-fg-muted">暂无应用</div>
        )}
        {filteredApps.length > 0 && (
          <table className="ui-tbl">
            <thead>
              <tr>
                <th className="w-72">应用</th>
                <th>负责人</th>
                <th>Worker</th>
                <th>Job</th>
                <th>QPS 配额</th>
                <th>Payload</th>
                <th>创建时间</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app, index) => {
                const worker = workerCountByApp[app.app_name];
                return (
                  <tr key={app.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <AppIcon index={index} appName={app.app_name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{app.app_name}</div>
                          <div className="mt-0.5 truncate text-[12px] text-fg-muted">
                            {app.description || app.webhook_url || '业务方应用'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-fg-muted">{app.owner || '-'}</td>
                    <td>
                      {worker ? (
                        <span className="inline-flex items-center gap-2 text-fg">
                          <span className="h-2 w-2 rounded-full bg-success" />
                          {worker.online} / {worker.total}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">-</span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const n = jobCountByApp[app.app_name] ?? 0;
                        if (n === 0) return <span className="text-fg-subtle">0</span>;
                        return (
                          <Link
                            to={`/jobs?app=${encodeURIComponent(app.app_name)}`}
                            className="font-medium text-accent hover:underline"
                            title={`查看 ${app.app_name} 的任务列表`}
                          >
                            {n}
                          </Link>
                        );
                      })()}
                    </td>
                    <td className="text-fg-muted">{app.qps_quota.toLocaleString('zh-CN')}/s</td>
                    <td className="text-fg-muted">{Math.round(app.payload_max_bytes / 1024)} KB</td>
                    <td className="text-fg-muted">{formatShortDate(app.created_at)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="text-[13px] font-medium text-fg-muted hover:text-accent" onClick={() => openEdit(app)}>
                          编辑
                        </button>
                        <button className="text-[13px] font-medium text-fg-muted hover:text-accent" onClick={() => setResetTarget(app)}>
                          重置 Secret
                        </button>
                        <RowMenu
                          onDisable={app.enabled ? () => setDisableTarget(app) : undefined}
                          onDelete={() => setDeleteTarget(app)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <AppForm
          key={editing?.id ?? 'create'}
          open={formOpen}
          onOpenChange={setFormOpen}
          app={editing}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除应用 ${deleteTarget?.app_name}？`}
        description="操作不可撤销。在线 worker 与未完成的任务会失去归属，请确认无依赖。"
        variant="destructive"
        confirmText="删除"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.app_name)}
      />

      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title={`禁用应用 ${disableTarget?.app_name}？`}
        description="禁用后该应用的 SDK 无法新建连接，已在线 worker 会被踢出。可随时通过编辑重新启用。"
        confirmText="禁用"
        loading={disableMutation.isPending}
        onConfirm={() => disableTarget && disableMutation.mutate(disableTarget.app_name)}
      />

      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
        title={`重置 ${resetTarget?.app_name} 的 app_secret？`}
        description="重置后旧密钥立即失效，所有使用旧密钥的 SDK 会鉴权失败。请确认已通知业务方。"
        variant="destructive"
        confirmText="重置"
        loading={resetMutation.isPending}
        onConfirm={() => resetTarget && resetMutation.mutate(resetTarget.app_name)}
      />

      <Dialog
        open={!!newSecret}
        onOpenChange={(v) => !v && setNewSecret(null)}
        title="新 app_secret · 请立即保存"
        description="此密钥仅展示一次，关闭后无法再查看。"
        footer={<Button onClick={() => setNewSecret(null)}>我已复制保存</Button>}
      >
        {newSecret && <SecretDisplay value={newSecret} />}
      </Dialog>
    </div>
  );
}

function formatShortDate(ts?: number | null): string {
  if (!ts || ts <= 0) return '-';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function AppIcon({ index, appName }: { index: number; appName: string }) {
  const iconStyles = [
    'bg-blue-500/10 text-blue-400',
    'bg-emerald-500/10 text-emerald-400',
    'bg-violet-500/10 text-violet-400',
    'bg-amber-500/10 text-amber-400',
    'bg-rose-500/10 text-rose-400',
  ];
  const icons = [Cloud, Globe2, Cpu, Radio, Cloud];
  const Icon = icons[index % icons.length];
  return (
    <div
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
        iconStyles[index % iconStyles.length],
      )}
      title={appName}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function RowMenu({ onDisable, onDelete }: { onDisable?: () => void; onDelete: () => void }) {
  const close = (e: MouseEvent) => {
    const details = (e.currentTarget as HTMLElement).closest('details');
    if (details) details.removeAttribute('open');
  };
  return (
    <details className="relative inline-block text-left">
      <summary className="list-none cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-28 rounded-lg border border-border bg-card py-1 shadow-menu">
        {onDisable && (
          <MenuItem
            onClick={(e) => {
              close(e);
              onDisable();
            }}
          >
            禁用
          </MenuItem>
        )}
        <MenuItem
          onClick={(e) => {
            close(e);
            onDelete();
          }}
          className="text-fg-muted hover:bg-danger-bg hover:text-danger"
        >
          删除
        </MenuItem>
      </div>
    </details>
  );
}

function MenuItem({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: (e: MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-[13px] text-fg transition hover:bg-bg-muted ${className || ''}`}
    >
      {children}
    </button>
  );
}

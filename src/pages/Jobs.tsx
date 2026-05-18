import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { appApi, jobApi, extractError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RowMenu } from '@/components/ui/row-menu';
import { useToast } from '@/components/ui/toast';
import { JobForm } from '@/components/JobForm';
import { formatUnix } from '@/lib/utils';
import type { Job, TriggerType } from '@/types/api';

function triggerLabel(t: TriggerType): string {
  switch (t) {
    case 'TRIGGER_TYPE_CRON':
      return 'Cron';
    case 'TRIGGER_TYPE_FIXED_RATE':
      return '固定间隔';
    case 'TRIGGER_TYPE_ONE_TIME':
      return '一次性';
    case 'TRIGGER_TYPE_API':
      return 'API 触发';
    case 'TRIGGER_TYPE_MANUAL':
      return '手动';
    case 'TRIGGER_TYPE_RETRY':
      return '重试';
    default:
      return t.replace('TRIGGER_TYPE_', '').toLowerCase();
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'running':
      return '运行中';
    case 'idle':
      return '空闲';
    case 'paused':
      return '已暂停';
    case 'pending':
      return '待调度';
    default:
      return s || '已启用';
  }
}

export default function JobsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [appName, setAppName] = useState(sp.get('app') || '');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const next = sp.get('app') || '';
    if (next !== appName) {
      setAppName(next);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const appsQ = useQuery({
    queryKey: ['appsForJobsFilter'],
    queryFn: () => appApi.list(),
    staleTime: 60_000,
  });
  const pageSize = 20;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Job | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [triggerTarget, setTriggerTarget] = useState<Job | null>(null);

  const jobs = useQuery({
    queryKey: ['jobs', appName, keyword, page],
    queryFn: () =>
      jobApi.list({
        app_name: appName || undefined,
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['jobs'] });

  const pauseMutation = useMutation({
    mutationFn: (j: Job) => (j.enabled ? jobApi.pause(j.job_name) : jobApi.resume(j.job_name)),
    onSuccess: (_d, j) => {
      invalidate();
      toast.success(j.enabled ? '已暂停' : '已恢复');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => jobApi.remove(name),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || '删除失败');
      invalidate();
      toast.success('任务已删除');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const triggerMutation = useMutation({
    mutationFn: (name: string) => jobApi.trigger(name),
    onSuccess: (data) => {
      toast.success(`已触发 run_id=${data.run_id}`);
      setTriggerTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (j: Job) => {
    setEditing(j);
    setFormOpen(true);
  };

  const total = jobs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">任务管理</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            {total} 个任务 · 第 {page}/{totalPages} 页
          </p>
        </div>
        <div className="flex gap-3">
          <select
            className="ui-input w-40"
            value={appName}
            onChange={(e) => {
              const v = e.target.value;
              setAppName(v);
              setPage(1);
              if (v) {
                setSp({ app: v });
              } else {
                setSp({});
              }
            }}
          >
            <option value="">所有应用</option>
            {(appsQ.data ?? []).map((a) => (
              <option key={a.app_name} value={a.app_name}>
                {a.app_name}
              </option>
            ))}
          </select>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="任务名 / 描述"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.isLoading && <div className="p-12 text-center text-[13px] text-fg-muted">加载中...</div>}
          {jobs.isError && (
            <div className="p-12 text-center text-[13px] text-danger">加载失败：{extractError(jobs.error)}</div>
          )}
          {jobs.data && jobs.data.jobs.length === 0 && (
            <div className="py-12 text-center text-[13px] text-fg-muted">
              暂无任务
            </div>
          )}
          {jobs.data && jobs.data.jobs.length > 0 && (
            <>
              <div>
                <table className="ui-tbl">
                  <thead>
                    <tr>
                      <th>任务名</th>
                      <th>应用</th>
                      <th>触发方式</th>
                      <th>表达式</th>
                      <th>状态</th>
                      <th>关键</th>
                      <th>创建时间</th>
                      <th className="w-20 pr-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.data.jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="font-medium text-fg">{j.job_name}</td>
                        <td className="text-fg-muted">{j.app_name}</td>
                        <td>
                          <Badge variant="outline">{triggerLabel(j.trigger_type)}</Badge>
                        </td>
                        <td className="font-mono text-[12px] text-fg-muted">
                          {j.trigger_type === 'TRIGGER_TYPE_CRON'
                            ? j.cron_expr
                            : j.trigger_type === 'TRIGGER_TYPE_FIXED_RATE'
                              ? `${j.fixed_rate_seconds}s`
                              : j.trigger_type === 'TRIGGER_TYPE_ONE_TIME'
                                ? formatUnix(j.one_time_at)
                                : '-'}
                        </td>
                        <td>
                          <Badge variant={j.enabled ? 'success' : 'secondary'}>
                            {j.enabled ? statusLabel(j.status) : '已禁用'}
                          </Badge>
                        </td>
                        <td>
                          {j.critical && <Badge variant="destructive">关键</Badge>}
                        </td>
                        <td className="text-fg-muted">
                          {formatUnix(j.created_at)}
                        </td>
                        <td className="pr-4 text-right">
                          <RowMenu
                            items={[
                              { label: '编辑', onClick: () => openEdit(j) },
                              {
                                label: '手动触发',
                                onClick: () => setTriggerTarget(j),
                              },
                              {
                                label: j.enabled ? '暂停' : '恢复',
                                onClick: () => pauseMutation.mutate(j),
                              },
                              {
                                label: '删除',
                                danger: true,
                                onClick: () => setDeleteTarget(j),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <JobForm
          key={editing?.id ?? 'create'}
          open={formOpen}
          onOpenChange={setFormOpen}
          job={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除任务 ${deleteTarget?.job_name}？`}
        description="历史 run 记录会保留，但任务本身和关联绑定会被清理。操作不可撤销。"
        variant="destructive"
        confirmText="删除"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.job_name)}
      />
      <ConfirmDialog
        open={!!triggerTarget}
        onOpenChange={(v) => !v && setTriggerTarget(null)}
        title={`立即触发 ${triggerTarget?.job_name}？`}
        description="后端会生成一次 run 并按调度策略派发；可在运行记录中查看结果。"
        confirmText="触发"
        loading={triggerMutation.isPending}
        onConfirm={() => triggerTarget && triggerMutation.mutate(triggerTarget.job_name)}
      />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-4 text-[13px] text-fg-muted">
      <span>
        第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <button
          className="ui-btn ui-btn-default ui-btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </button>
        <button
          className="ui-btn ui-btn-default ui-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

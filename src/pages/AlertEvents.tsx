import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertApi, extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RowMenu } from '@/components/ui/row-menu';
import { useToast } from '@/components/ui/toast';
import { formatUnix, relativeTime } from '@/lib/utils';

/**
 * 告警事件列表：支持分页、状态过滤与 job_name 过滤。
 *
 * resolve / silence 直接走后端操作接口，完成后刷新当前列表，避免本地状态与后端不一致。
 */
const statusVariant: Record<string, BadgeProps['variant']> = {
  firing: 'destructive',
  silenced: 'warning',
  resolved: 'success',
  escalated: 'destructive',
};

const severityLabel: Record<string, string> = {
  ALERT_SEVERITY_INFO: 'info',
  ALERT_SEVERITY_WARN: 'warn',
  ALERT_SEVERITY_ERROR: 'error',
  ALERT_SEVERITY_CRITICAL: 'critical',
};

export default function AlertEventsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const operator = useAuthStore((s) => s.user?.username) || 'unknown';
  const [status, setStatus] = useState('');
  const [jobName, setJobName] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const resolveMutation = useMutation({
    mutationFn: (id: number) => alertApi.resolveEvent(id, operator),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertEvents'] });
      toast.success('已标记 resolved');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const silenceMutation = useMutation({
    mutationFn: (id: number) => alertApi.silenceEvent(id, 3600, operator),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertEvents'] });
      toast.success('已静默 1 小时');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const events = useQuery({
    queryKey: ['alertEvents', status, jobName, page],
    queryFn: () =>
      alertApi.listEvents({
        status: status || undefined,
        job_name: jobName || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const total = events.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">告警事件</h1>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="">全部状态</option>
            <option value="firing">firing</option>
            <option value="silenced">silenced</option>
            <option value="resolved">resolved</option>
            <option value="escalated">escalated</option>
          </select>
          <Input
            placeholder="job_name"
            value={jobName}
            onChange={(e) => {
              setJobName(e.target.value);
              setPage(1);
            }}
            className="w-48"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            共 {total} 条事件 · 第 {page}/{totalPages} 页
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.isLoading && <div className="text-sm text-fg-muted">加载中…</div>}
          {events.isError && (
            <div className="text-sm text-danger">加载失败：{extractError(events.error)}</div>
          )}
          {events.data && events.data.events.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-fg-muted">
              暂无事件
            </div>
          )}
          {events.data && events.data.events.length > 0 && (
            <>
              <div className="space-y-2">
                {events.data.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between rounded-md border border-border p-3 text-sm"
                  >
                    <div className="flex flex-1 items-start gap-3">
                      <Badge variant={statusVariant[ev.status] || 'outline'}>{ev.status}</Badge>
                      <Badge variant="outline">{severityLabel[ev.severity] || 'warn'}</Badge>
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">{ev.summary || '(无摘要)'}</div>
                        {ev.detail && <div className="text-xs text-fg-muted">{ev.detail}</div>}
                        <div className="text-xs text-fg-muted">
                          job={ev.job_name} · rule_id={ev.rule_id} · channel_id={ev.channel_id}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1 text-xs text-fg-muted">
                      <div>{relativeTime(ev.created_at)}</div>
                      <div>{formatUnix(ev.created_at)}</div>
                      {ev.notified_at > 0 && <div className="text-success">已推送</div>}
                      <RowMenu
                        items={[
                          {
                            label: '标记 resolved',
                            hidden: ev.status === 'resolved',
                            onClick: () => resolveMutation.mutate(ev.id),
                          },
                          {
                            label: '静默 1 小时',
                            hidden: ev.status === 'resolved' || ev.status === 'silenced',
                            onClick: () => silenceMutation.mutate(ev.id),
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
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
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button
        className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span className="text-fg-muted">
        {page} / {totalPages}
      </span>
      <button
        className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
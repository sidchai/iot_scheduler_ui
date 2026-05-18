import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workerApi, extractError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/dialog';
import type { Worker } from '@/types/api';

/**
 * Worker 节点页。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html L1067-L1132：
 *   - 顶部 KPI：在线 / 离线 数量摘要
 *   - 过滤：应用 + 状态下拉
 *   - 表格：状态点 / workerId / 应用 / IP / SDK 版本 / inflight / 心跳 / Load / 操作
 *   - 行操作：踢下线（强制断连，常用于发版灰度或异常节点处理）
 *   - 自动刷新 5s（可关闭）
 *
 * 状态判定：proto 的 status 字段是 string，但实际 worker 心跳超时由后端兜底；
 * 前端再叠一层"心跳秒数"展示，方便运维一眼看出"看似 online 实际心跳已 60s 没来"。
 */
export default function WorkersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [appFilter, setAppFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [kickTarget, setKickTarget] = useState<Worker | null>(null);

  const q = useQuery({
    queryKey: ['workers', appFilter, statusFilter],
    queryFn: () =>
      workerApi.list({
        app_name: appFilter || undefined,
        status: statusFilter || undefined,
      }),
    refetchInterval: autoRefresh ? 5_000 : false,
  });

  const kickMu = useMutation({
    mutationFn: (workerId: string) => workerApi.kick(workerId, 'kicked from UI'),
    onSuccess: (r, workerId) => {
      if (r.ok) {
        toast.success(`已踢下线 ${workerId}`);
        qc.invalidateQueries({ queryKey: ['workers'] });
      } else {
        toast.error(r.error || '操作失败');
      }
      setKickTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  // 提取所有出现过的 app_name 作为下拉选项（避免硬编码）
  const apps = useMemo(() => {
    if (!q.data) return [];
    return Array.from(new Set(q.data.map((w) => w.app_name))).sort();
  }, [q.data]);

  const online = q.data?.filter((w) => w.status === 'online').length ?? 0;
  const offline = q.data?.filter((w) => w.status === 'offline').length ?? 0;
  const draining = q.data?.filter((w) => w.status === 'draining').length ?? 0;

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">Worker 节点</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {online} 在线 · {draining} 排空 · {offline} 离线
            {autoRefresh && ' · 自动刷新 5s'}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-fg-muted">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          自动刷新
        </label>
      </div>

      <div className="ui-card overflow-hidden">
        {/* 过滤栏 */}
        <div className="flex gap-2.5 border-b border-border p-4">
          <select
            className="ui-input"
            style={{ width: 220 }}
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
          >
            <option value="">所有应用</option>
            {apps.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="ui-input"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">所有状态</option>
            <option value="online">online</option>
            <option value="draining">draining</option>
            <option value="offline">offline</option>
          </select>
        </div>

        {q.isLoading ? (
          <Empty text="加载中…" />
        ) : q.error ? (
          <Empty text={extractError(q.error)} danger />
        ) : !q.data || q.data.length === 0 ? (
          <Empty text="没有匹配的 Worker" />
        ) : (
          <table className="ui-tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>状态</th>
                <th>workerId</th>
                <th>应用</th>
                <th>IP</th>
                <th>SDK</th>
                <th>inflight</th>
                <th>心跳</th>
                <th>Load</th>
                <th className="pr-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((w) => {
                const hb = heartbeatBadge(w.last_heartbeat, w.status);
                const isOffline = w.status === 'offline';
                return (
                  <tr key={w.worker_id} className={isOffline ? 'bg-danger-bg/40' : undefined}>
                    <td>
                      <span className={`ui-dot ${dotClass(w.status)}`} />
                    </td>
                    <td>
                      <code className={`text-[12px] font-medium ${isOffline ? 'text-fg-muted' : ''}`}>
                        {w.worker_id}
                      </code>
                    </td>
                    <td className={isOffline ? 'text-fg-muted' : undefined}>
                      {w.app_name}
                    </td>
                    <td>
                      <code className="text-[12px] text-fg-muted">{w.ip}</code>
                    </td>
                    <td className={isOffline ? 'text-fg-muted' : undefined}>
                      {w.sdk_version || '-'}
                    </td>
                    <td className={isOffline ? 'text-fg-muted' : undefined}>
                      {isOffline ? '-' : w.inflight}
                    </td>
                    <td>
                      <span className={`ui-badge ${hb.cls}`}>{hb.text}</span>
                    </td>
                    <td className={isOffline ? 'text-fg-muted' : undefined}>
                      {isOffline ? '-' : w.load_avg.toFixed(2)}
                    </td>
                    <td className="pr-4 text-right">
                      {isOffline ? (
                        <span className="text-[12px] text-fg-subtle">已离线</span>
                      ) : (
                        <button
                          type="button"
                          className="ui-link ui-link-danger"
                          onClick={() => setKickTarget(w)}
                        >
                          踢下线
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 踢下线确认 */}
      <ConfirmDialog
        open={!!kickTarget}
        onOpenChange={(o) => !o && setKickTarget(null)}
        title="踢下线 Worker"
        description={
          kickTarget
            ? `确定踢下线 ${kickTarget.worker_id}？该 Worker 上 ${kickTarget.inflight} 条 inflight Run 会被标记为 dispatch_fail，由调度器重派给其他 Worker。`
            : ''
        }
        confirmText="踢下线"
        variant="destructive"
        loading={kickMu.isPending}
        onConfirm={() => kickTarget && kickMu.mutate(kickTarget.worker_id)}
      />
    </>
  );
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

// 状态点颜色：online=success, draining=warning, offline=muted
function dotClass(status: string): string {
  if (status === 'online') return 'ui-dot-success';
  if (status === 'draining') return 'ui-dot-warning';
  return 'ui-dot-muted';
}

// 心跳徽章：根据 last_heartbeat 距今秒数 + status 综合显示
//   <30s 绿色，30-60s 黄色，>60s 红色（包括 offline）
function heartbeatBadge(
  lastHbSec: number,
  status: string,
): { cls: string; text: string } {
  if (!lastHbSec) return { cls: 'ui-badge-default', text: '-' };
  const ageSec = Math.max(0, Math.floor(Date.now() / 1000 - lastHbSec));
  if (status === 'offline') {
    return { cls: 'ui-badge-danger', text: `离线 ${humanAge(ageSec)}` };
  }
  if (ageSec > 60) return { cls: 'ui-badge-danger', text: `${humanAge(ageSec)}` };
  if (ageSec > 30) return { cls: 'ui-badge-warning', text: `${ageSec}s` };
  return { cls: 'ui-badge-success', text: `${ageSec}s` };
}

function humanAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟`;
  return `${Math.floor(sec / 3600)}小时`;
}

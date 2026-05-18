import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pendingChangeApi, extractError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth';
import { formatUnix } from '@/lib/utils';
import type { PendingChange } from '@/types/api';

/**
 * 双人复核（PendingChange）页：
 *
 * 业务背景：critical=true 的任务被 UpdateJob/DeleteJob/PauseJob 时，
 * 后端不直接落库，而是写入 sched_pending_change 等待另一名运维点 "批准"。
 *
 * 视觉对齐：复用 ui-card / ui-tbl / ui-btn / ui-badge 等全局类（与 Workers/Audit 一致）。
 *
 * 关键约束（后端 pending_change_ops.go）：
 *   1. approver 必须 ≠ proposer（two-man rule）
 *   2. 仅 status=pending 可批准/驳回
 *   3. expires_at 超时自动失效（24h TTL）
 *
 * change_diff 是 JSON，包裹 {action: update/delete/pause, job?, reason?}。
 * 列表只展示 action + 截断 diff；详情对话框格式化整段 JSON 便于审阅。
 */
export default function PendingChangesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [detail, setDetail] = useState<PendingChange | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingChange | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<PendingChange | null>(null);

  const q = useQuery({
    queryKey: ['pendingChanges', statusFilter],
    queryFn: () => pendingChangeApi.list(statusFilter || undefined),
    refetchInterval: 15_000,
  });

  const approveMu = useMutation({
    mutationFn: (id: number) => pendingChangeApi.approve(id),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success('已批准');
        qc.invalidateQueries({ queryKey: ['pendingChanges'] });
      } else {
        toast.error(r.error || '批准失败');
      }
      setApproveTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const rejectMu = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      pendingChangeApi.reject(id, reason),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success('已驳回');
        qc.invalidateQueries({ queryKey: ['pendingChanges'] });
      } else {
        toast.error(r.error || '驳回失败');
      }
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const counts = useMemo(() => {
    const items = q.data ?? [];
    return {
      total: items.length,
      pending: items.filter((p) => p.status === 'pending').length,
    };
  }, [q.data]);

  // 当前登录用户名（用于校验 approver ≠ proposer，登录态由 stores/auth 提供）
  const myName = me?.username || '';

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">双人复核</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            critical 任务的变更需另一名运维审批 · 共 {counts.total} 条
            {statusFilter === 'pending' && ` · ${counts.pending} 待处理`}
          </p>
        </div>
        <select
          className="ui-input"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="pending">待审批</option>
          <option value="approved">已批准</option>
          <option value="rejected">已驳回</option>
          <option value="expired">已过期</option>
        </select>
      </div>

      <div className="ui-card overflow-hidden">
        {q.isLoading ? (
          <Empty text="加载中…" />
        ) : q.error ? (
          <Empty text={extractError(q.error)} danger />
        ) : !q.data || q.data.length === 0 ? (
          <Empty text="暂无待审批改动" />
        ) : (
          <table className="ui-tbl">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>对象</th>
                <th>动作</th>
                <th>提议人</th>
                <th>提议时间</th>
                <th>过期时间</th>
                <th>状态</th>
                <th>审批人</th>
                <th className="pr-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => {
                const env = parseEnvelope(p.change_diff);
                const isPending = p.status === 'pending';
                const isExpired =
                  isPending && p.expires_at > 0 && p.expires_at * 1000 < Date.now();
                const selfProposed = myName !== '' && myName === p.proposer;
                return (
                  <tr key={p.id}>
                    <td>
                      <code className="text-[12px] text-fg-muted">{p.id}</code>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[12px] uppercase text-fg-subtle">
                          {p.target_type}
                        </span>
                        <code className="text-[12.5px] font-medium">{p.target_id}</code>
                      </div>
                    </td>
                    <td>
                      <span className={`ui-badge ${actionBadgeClass(env.action)}`}>
                        {env.action || '-'}
                      </span>
                    </td>
                    <td>{p.proposer}</td>
                    <td className="text-[12px] text-fg-muted">{formatUnix(p.proposed_at)}</td>
                    <td className="text-[12px] text-fg-muted">
                      {isExpired ? (
                        <span className="text-danger">已过期</span>
                      ) : (
                        formatUnix(p.expires_at)
                      )}
                    </td>
                    <td>
                      <span className={`ui-badge ${statusBadgeClass(p.status, isExpired)}`}>
                        {isExpired ? 'expired' : p.status}
                      </span>
                    </td>
                    <td>{p.approver || '-'}</td>
                    <td className="pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="ui-link"
                          onClick={() => setDetail(p)}
                        >
                          详情
                        </button>
                        {isPending && !isExpired && (
                          <>
                            <button
                              type="button"
                              className="ui-link"
                              disabled={selfProposed}
                              title={selfProposed ? '不能审批自己提交的改动' : ''}
                              onClick={() =>
                                !selfProposed && setApproveTarget(p)
                              }
                              style={selfProposed ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                            >
                              批准
                            </button>
                            <button
                              type="button"
                              className="ui-link ui-link-danger"
                              disabled={selfProposed}
                              title={selfProposed ? '不能驳回自己提交的改动' : ''}
                              onClick={() =>
                                !selfProposed && setRejectTarget(p)
                              }
                              style={selfProposed ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                            >
                              驳回
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 详情对话框：格式化 change_diff JSON */}
      <Dialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail ? `改动详情 #${detail.id}` : ''}
        description={
          detail ? `${detail.target_type}:${detail.target_id} · 提议人 ${detail.proposer}` : ''
        }
        className="max-w-3xl"
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <KvRow label="状态" value={detail.status} />
            <KvRow label="提议时间" value={formatUnix(detail.proposed_at)} />
            <KvRow label="过期时间" value={formatUnix(detail.expires_at)} />
            {detail.approver && (
              <>
                <KvRow label="审批人" value={detail.approver} />
                <KvRow label="审批时间" value={formatUnix(detail.approved_at)} />
              </>
            )}
            <div>
              <div className="mb-1 text-[12px] font-medium text-fg-muted">变更内容（JSON）</div>
              <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-bg p-3 text-[12px] leading-relaxed">
                {prettyJson(detail.change_diff)}
              </pre>
            </div>
          </div>
        )}
      </Dialog>

      {/* 批准确认 */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="批准改动"
        description={
          approveTarget
            ? `确定批准 ${approveTarget.target_type}:${approveTarget.target_id} 的改动？批准后立即生效，不可撤销。`
            : ''
        }
        confirmText="批准"
        loading={approveMu.isPending}
        onConfirm={() => approveTarget && approveMu.mutate(approveTarget.id)}
      />

      {/* 驳回对话框：必须输入原因 */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
        title="驳回改动"
        description={
          rejectTarget
            ? `${rejectTarget.target_type}:${rejectTarget.target_id}`
            : ''
        }
        footer={
          <>
            <button
              className="ui-btn ui-btn-default"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
              disabled={rejectMu.isPending}
            >
              取消
            </button>
            <button
              className="ui-btn ui-btn-danger"
              disabled={rejectMu.isPending || rejectReason.trim() === ''}
              onClick={() =>
                rejectTarget &&
                rejectMu.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
              }
            >
              {rejectMu.isPending ? '处理中…' : '驳回'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-[12.5px] text-fg-muted">驳回原因（必填，最长 500 字符）</label>
          <textarea
            className="ui-input w-full"
            rows={4}
            maxLength={500}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="例如：参数偏离生产基线 / 影响面未评估清楚 / 建议拆分两次提交"
          />
        </div>
      </Dialog>
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

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-[12px] text-fg-muted">{label}</span>
      <span className="text-[13px]">{value}</span>
    </div>
  );
}

// change_diff 是 JSON 字符串，包裹 {action, job?, reason?}；解析失败时回落到空 envelope。
function parseEnvelope(diff: string): { action: string; reason?: string } {
  try {
    const obj = JSON.parse(diff);
    return { action: String(obj.action || ''), reason: obj.reason };
  } catch {
    return { action: '' };
  }
}

// 把 change_diff 格式化为缩进 JSON 供详情查看；解析失败原样返回。
function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function actionBadgeClass(action: string): string {
  if (action === 'update') return 'ui-badge-blue';
  if (action === 'delete') return 'ui-badge-danger';
  if (action === 'pause') return 'ui-badge-warning';
  return 'ui-badge-default';
}

function statusBadgeClass(status: string, isExpired: boolean): string {
  if (isExpired) return 'ui-badge-danger';
  if (status === 'pending') return 'ui-badge-warning';
  if (status === 'approved') return 'ui-badge-success';
  if (status === 'rejected') return 'ui-badge-danger';
  if (status === 'expired') return 'ui-badge-default';
  return 'ui-badge-default';
}

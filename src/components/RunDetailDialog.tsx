import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { runApi, extractError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatUnix } from '@/lib/utils';
import type { Run, RunStatus } from '@/types/api';

/**
 * Run 详情弹窗：展示单条运行记录的完整信息。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html 的 modal-run-detail（L1457+）。
 * 关键能力：
 *   - 顶部摘要：runId / jobName / 状态徽章 / 耗时 / worker / 重试次数
 *   - 中部时间线：created → dispatching → dispatched → started → ended（按时间戳渲染）
 *   - 下部：payload / output（base64 解码展示） / error
 *   - 底部：失败/超时的 Run 提供"重试"按钮；未完成的 Run 提供"取消"按钮
 *
 * 实现细节：
 *   - payload / output 是 proto bytes，protojson 编码后为 base64 字符串；
 *     用 atob + decodeURIComponent(escape(...)) 解 UTF-8（小心非 UTF-8 二进制）。
 *   - 时间戳：created_at 是秒，其他 dispatching_at/started_at/ended_at 是毫秒。
 */
export function RunDetailDialog({
  open,
  onOpenChange,
  runId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runApi.get(runId),
    enabled: open && !!runId,
  });

  const cancelMu = useMutation({
    mutationFn: () => runApi.cancel(runId, 'canceled from UI'),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success('已取消');
        qc.invalidateQueries({ queryKey: ['run', runId] });
        qc.invalidateQueries({ queryKey: ['runs'] });
      } else {
        toast.error(r.error || '取消失败');
      }
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const retryMu = useMutation({
    mutationFn: () => runApi.retry(runId),
    onSuccess: (r) => {
      toast.success(`已重试，新 runId: ${r.new_run_id.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ['runs'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[90vh] w-[760px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-[15px] font-semibold">运行详情</div>
            <div className="mt-0.5 font-mono text-[11.5px] text-fg-subtle">{runId}</div>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {detailQuery.isLoading && (
            <div className="py-10 text-center text-[13px] text-fg-muted">加载中…</div>
          )}
          {detailQuery.error && (
            <div className="py-10 text-center text-[13px] text-danger">
              {extractError(detailQuery.error)}
            </div>
          )}
          {detailQuery.data && <RunDetailBody run={detailQuery.data} />}
        </div>

        {/* Footer 操作 */}
        {detailQuery.data && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
            {isCancelable(detailQuery.data.status) && (
              <button
                type="button"
                className="ui-btn ui-btn-danger ui-btn-sm"
                disabled={cancelMu.isPending}
                onClick={() => cancelMu.mutate()}
              >
                {cancelMu.isPending ? '取消中…' : '取消该 Run'}
              </button>
            )}
            {isRetryable(detailQuery.data.status) && (
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                disabled={retryMu.isPending}
                onClick={() => retryMu.mutate()}
              >
                {retryMu.isPending ? '重试中…' : '手动重试'}
              </button>
            )}
            <button
              type="button"
              className="ui-btn ui-btn-default ui-btn-sm"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 未完成态可取消
function isCancelable(s: RunStatus): boolean {
  return ['RUN_STATUS_PENDING', 'RUN_STATUS_DISPATCHING', 'RUN_STATUS_DISPATCHED', 'RUN_STATUS_RUNNING'].includes(s);
}
// 失败/超时/取消/派发失败可重试
function isRetryable(s: RunStatus): boolean {
  return ['RUN_STATUS_FAILED', 'RUN_STATUS_TIMEOUT', 'RUN_STATUS_CANCELED', 'RUN_STATUS_DISPATCH_FAIL'].includes(s);
}

// 把 RunStatus 全名缩成短文本 + 对应 badge 类
const STATUS_MAP: Record<RunStatus, { label: string; cls: string }> = {
  RUN_STATUS_UNSPECIFIED: { label: 'unknown', cls: 'ui-badge-default' },
  RUN_STATUS_PENDING: { label: 'pending', cls: 'ui-badge-default' },
  RUN_STATUS_DISPATCHING: { label: 'dispatching', cls: 'ui-badge-info' },
  RUN_STATUS_DISPATCHED: { label: 'dispatched', cls: 'ui-badge-info' },
  RUN_STATUS_RUNNING: { label: 'running', cls: 'ui-badge-info' },
  RUN_STATUS_SUCCESS: { label: 'success', cls: 'ui-badge-success' },
  RUN_STATUS_FAILED: { label: 'failed', cls: 'ui-badge-danger' },
  RUN_STATUS_TIMEOUT: { label: 'timeout', cls: 'ui-badge-warning' },
  RUN_STATUS_CANCELED: { label: 'canceled', cls: 'ui-badge-default' },
  RUN_STATUS_DISPATCH_FAIL: { label: 'dispatch_fail', cls: 'ui-badge-danger' },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const m = STATUS_MAP[status] || STATUS_MAP.RUN_STATUS_UNSPECIFIED;
  return <span className={`ui-badge ${m.cls}`}>{m.label}</span>;
}

function RunDetailBody({ run }: { run: Run }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-5">
      {/* 摘要 grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        <Field label="任务" value={run.job_name} mono />
        <Field label="应用" value={run.app_name} />
        <Field label="状态" custom={<StatusBadge status={run.status} />} />
        <Field
          label="耗时"
          value={run.duration_ms > 0 ? formatDuration(run.duration_ms) : '-'}
        />
        <Field label="Worker" value={run.worker_id || '-'} mono />
        <Field
          label="重试次数"
          value={String(run.retry_count)}
          highlight={run.retry_count > 0}
        />
        <Field label="bizKey" value={run.biz_key || '-'} mono />
        <Field
          label="触发"
          value={run.trigger_type.replace('TRIGGER_TYPE_', '').toLowerCase()}
        />
      </div>

      {/* 错误信息（仅失败/超时时显示） */}
      {run.error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-3">
          <div className="mb-1 text-[12px] font-semibold text-[#B91C1C]">错误</div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-[#B91C1C]">
            {run.error}
          </pre>
        </div>
      )}

      {/* 时间线 */}
      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-subtle">
          执行时间线
        </div>
        <div className="ui-timeline text-[12.5px]">
          <TimelinePoint label="created" tsMs={run.created_at * 1000} kind="default" />
          <TimelinePoint label="dispatching" tsMs={run.dispatching_at} kind="default" />
          <TimelinePoint label="dispatched" tsMs={run.dispatched_at} kind="default" />
          <TimelinePoint label="started" tsMs={run.started_at} kind="default" />
          <TimelinePoint
            label="ended"
            tsMs={run.ended_at}
            kind={
              run.status === 'RUN_STATUS_SUCCESS'
                ? 'success'
                : run.status === 'RUN_STATUS_FAILED' || run.status === 'RUN_STATUS_TIMEOUT'
                  ? 'error'
                  : 'default'
            }
          />
        </div>
      </div>

      {/* Payload + Output */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-fg-subtle">
            数据体
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm text-[11.5px]"
            onClick={() => setShowRaw((v) => !v)}
          >
            {showRaw ? '解码 UTF-8' : '显示原始 base64'}
          </button>
        </div>
        <BlobBlock label="payload" b64={run.payload} raw={showRaw} />
        <BlobBlock label="output" b64={run.output} raw={showRaw} />
      </div>

      {/* trace_id / parent_run_id */}
      {(run.trace_id || run.parent_run_id) && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-border pt-4 text-[12px] text-fg-muted">
          {run.parent_run_id && (
            <Field label="父 RunID" value={run.parent_run_id} mono small />
          )}
          {run.trace_id && <Field label="TraceID" value={run.trace_id} mono small />}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  custom,
  mono,
  highlight,
  small,
}: {
  label: string;
  value?: string;
  custom?: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className={small ? 'col-span-2' : undefined}>
      <div className="text-[11.5px] uppercase tracking-wider text-fg-subtle">{label}</div>
      <div
        className={[
          'mt-0.5 break-all',
          mono ? 'font-mono text-[12.5px]' : '',
          highlight ? 'font-semibold text-warning' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {custom ?? value}
      </div>
    </div>
  );
}

function TimelinePoint({
  label,
  tsMs,
  kind,
}: {
  label: string;
  tsMs: number;
  kind: 'default' | 'success' | 'error';
}) {
  if (!tsMs || tsMs <= 0) {
    return (
      <div className="ui-timeline-item opacity-40">
        <div className="text-[11.5px] text-fg-subtle">{label}</div>
        <div className="text-[11.5px] text-fg-subtle">未达到</div>
      </div>
    );
  }
  return (
    <div className={`ui-timeline-item ${kind === 'default' ? '' : kind}`}>
      <div className="font-medium">{label}</div>
      <div className="text-[11.5px] text-fg-muted">{formatUnix(Math.floor(tsMs / 1000))}</div>
    </div>
  );
}

/**
 * BlobBlock：渲染 proto bytes 字段。
 *
 * raw=true 直接展示 base64 原文（适合二进制 payload）；
 * raw=false 用 atob + UTF-8 decode（适合 JSON / 文本 payload）。
 */
function BlobBlock({ label, b64, raw }: { label: string; b64: string; raw: boolean }) {
  let text: string;
  if (!b64) {
    text = '(空)';
  } else if (raw) {
    text = b64;
  } else {
    try {
      // atob 拿到的是 latin1 字符串，需要按字节重组为 UTF-8
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      text = '(解码失败，请切换原始 base64)';
    }
  }
  // 尝试格式化 JSON（如果是合法 JSON 就 pretty print）
  if (!raw && text.startsWith('{')) {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      /* keep raw text */
    }
  }
  return (
    <div>
      <div className="mb-1 text-[11.5px] font-medium text-fg-muted">{label}</div>
      <pre className="max-h-48 overflow-y-auto rounded-md border border-border bg-hover/50 p-2.5 font-mono text-[11.5px] leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

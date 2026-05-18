import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Activity, History, AlertTriangle, Search } from 'lucide-react';
import { appApi, runApi, extractError } from '@/lib/api';
import { formatUnix } from '@/lib/utils';
import { RunDetailDialog, StatusBadge } from '@/components/RunDetailDialog';
import type { Run, RunStatus } from '@/types/api';

/**
 * 执行记录页。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html L831-L988：
 *   - 三个 tab：实时 / 历史 / 派发失败
 *   - 实时：5s 自动刷新，只展示未完成态（pending/dispatching/dispatched/running）
 *   - 历史：完整字段表格 + 状态/jobName/bizKey 过滤 + 分页
 *   - 派发失败：只展示 dispatch_fail 状态，附顶部说明条
 *   - 任意行点击打开 RunDetailDialog
 *
 * 状态映射：proto enum 全名（RUN_STATUS_xxx）→ UI 文本/徽章颜色（见 RunDetailDialog 中的 STATUS_MAP）。
 */

// 实时 tab 关心的"未完成"状态集合。
// 后端 ListRuns 不支持 status IN (...) 复合过滤，前端用 useQueries 并行 4 次拉取再合并，
// 保证每次请求都带 status 参数走服务端索引（idx_job_status_created）。
const INFLIGHT_STATUSES: RunStatus[] = [
  'RUN_STATUS_PENDING',
  'RUN_STATUS_DISPATCHING',
  'RUN_STATUS_DISPATCHED',
  'RUN_STATUS_RUNNING',
];

type TabKey = 'live' | 'history' | 'failed';

export default function RunsPage() {
  const [tab, setTab] = useState<TabKey>('live');
  const [detailRunId, setDetailRunId] = useState<string | null>(null);

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">执行记录</h1>
          <p className="mt-1 text-[13px] text-fg-muted">所有任务运行历史与实时状态</p>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        {/* tab 切换条 */}
        <div className="flex border-b border-border px-4">
          <TabButton active={tab === 'live'} onClick={() => setTab('live')}>
            <Activity className="mr-1 inline h-3.5 w-3.5" />
            实时
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            <History className="mr-1 inline h-3.5 w-3.5" />
            历史
          </TabButton>
          <TabButton active={tab === 'failed'} onClick={() => setTab('failed')}>
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            派发失败
          </TabButton>
        </div>

        {tab === 'live' && <LiveTab onOpenDetail={setDetailRunId} />}
        {tab === 'history' && <HistoryTab onOpenDetail={setDetailRunId} />}
        {tab === 'failed' && <FailedTab onOpenDetail={setDetailRunId} />}
      </div>

      {detailRunId && (
        <RunDetailDialog
          open={!!detailRunId}
          onOpenChange={(o) => !o && setDetailRunId(null)}
          runId={detailRunId}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-tab-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

// ============== 实时 tab ==============
function LiveTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const qc = useQueryClient();
  // 4 个 inflight 状态并行 fetch：每条请求都带 status 过滤，命中后端索引；
  // 5s 自动刷新，统一 invalidate 4 个 query。
  const results = useQueries({
    queries: INFLIGHT_STATUSES.map((s) => ({
      queryKey: ['runs', 'live', s] as const,
      queryFn: () => runApi.list({ status: s, page: 1, page_size: 50 }),
      refetchInterval: 5_000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const firstError = results.find((r) => r.error)?.error;

  // 合并并按 created_at DESC 排序，避免不同状态打乱顺序
  const inflight = useMemo<Run[]>(() => {
    const all = results.flatMap((r) => r.data?.runs ?? []);
    return all.sort((a, b) => b.created_at - a.created_at);
  }, [results]);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-zinc-50/50 px-4 py-2.5 text-[12px] text-fg-muted">
        <span
          className="ui-dot ui-dot-success"
          style={{ width: 6, height: 6 }}
          aria-hidden
        />
        实时刷新（每 5s）· 当前未完成 {inflight.length} 条
        <button
          type="button"
          className="ml-auto ui-link"
          onClick={() => qc.invalidateQueries({ queryKey: ['runs', 'live'] })}
        >
          手动刷新
        </button>
      </div>

      {isLoading ? (
        <EmptyRow text="加载中…" />
      ) : firstError ? (
        <EmptyRow text={extractError(firstError)} danger />
      ) : inflight.length === 0 ? (
        <EmptyRow text="当前没有正在执行的任务" />
      ) : (
        <table className="ui-tbl">
          <thead>
            <tr>
              <th>运行 ID</th>
              <th>任务</th>
              <th>状态</th>
              <th>业务键</th>
              <th>Worker</th>
              <th>已耗时</th>
              <th className="pr-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {inflight.map((r) => {
              const elapsed = elapsedMs(r);
              return (
                <tr
                  key={r.run_id}
                  className="cursor-pointer"
                  onClick={() => onOpenDetail(r.run_id)}
                >
                  <td>
                    <code className="text-[12px]">{r.run_id.slice(0, 8)}…</code>
                  </td>
                  <td>
                    <span className="font-medium">{r.job_name}</span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <code className="text-[12px] text-fg-muted">{r.biz_key || '-'}</code>
                  </td>
                  <td>
                    <span className="text-[13px]">{r.worker_id || '-'}</span>
                  </td>
                  <td>
                    <span className={`ui-badge ${elapsedClass(elapsed)}`}>
                      {formatDuration(elapsed)}
                    </span>
                  </td>
                  <td className="pr-4 text-right">
                    <button
                      type="button"
                      className="ui-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(r.run_id);
                      }}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

// 计算"已耗时"：started 之后用 now-started；未 started 用 now-created
function elapsedMs(r: Run): number {
  if (r.started_at > 0) return Date.now() - r.started_at;
  return Date.now() - r.created_at * 1000;
}
// 颜色：< 5s info，5-30s warning，>30s danger
function elapsedClass(ms: number): string {
  if (ms < 5_000) return 'ui-badge-info';
  if (ms < 30_000) return 'ui-badge-warning';
  return 'ui-badge-danger';
}

// ============== 历史 tab ==============
function HistoryTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  // URL ?app=xxx 可从 Apps 页跳转过来预填筛选条件
  const [sp, setSp] = useSearchParams();
  const initialApp = sp.get('app') || '';

  // 草稿态：用户在输入框/下拉里改的值
  const [draftApp, setDraftApp] = useState(initialApp);
  const [draftStatus, setDraftStatus] = useState<RunStatus | ''>('');
  const [draftJob, setDraftJob] = useState('');
  const [draftBiz, setDraftBiz] = useState('');

  // 已应用态：实际触发 query 的条件，仅在点"搜索"或回车时同步
  const [appliedApp, setAppliedApp] = useState(initialApp);
  const [appliedStatus, setAppliedStatus] = useState<RunStatus | ''>('');
  const [appliedJob, setAppliedJob] = useState('');
  const [appliedBiz, setAppliedBiz] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 应用列表用于下拉，失败时降级为空数组（不阻塞主流程）
  const appsQ = useQuery({
    queryKey: ['appsForRunsFilter'],
    queryFn: () => appApi.list(),
    staleTime: 60_000,
  });

  const apply = () => {
    setAppliedApp(draftApp);
    setAppliedStatus(draftStatus);
    setAppliedJob(draftJob);
    setAppliedBiz(draftBiz);
    setPage(1);
    // 同步 URL，便于刷新/分享保持筛选
    if (draftApp) {
      setSp({ app: draftApp });
    } else {
      setSp({});
    }
  };

  const reset = () => {
    setDraftApp('');
    setDraftStatus('');
    setDraftJob('');
    setDraftBiz('');
    setAppliedApp('');
    setAppliedStatus('');
    setAppliedJob('');
    setAppliedBiz('');
    setPage(1);
    setSp({});
  };

  // status / app_name / job_name / biz_key_like 均按服务端过滤，空字符串=不过滤
  const q = useQuery({
    queryKey: ['runs', 'history', appliedApp, appliedStatus, appliedJob, appliedBiz, page],
    queryFn: () =>
      runApi.list({
        app_name: appliedApp || undefined,
        status: appliedStatus || undefined,
        job_name: appliedJob || undefined,
        biz_key_like: appliedBiz || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="flex flex-wrap gap-2.5 border-b border-border p-4">
        <select
          className="ui-input"
          style={{ width: 180 }}
          value={draftApp}
          onChange={(e) => setDraftApp(e.target.value)}
        >
          <option value="">所有应用</option>
          {(appsQ.data ?? []).map((a) => (
            <option key={a.app_name} value={a.app_name}>
              {a.app_name}
            </option>
          ))}
        </select>
        <select
          className="ui-input"
          style={{ width: 180 }}
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value as RunStatus | '')}
        >
          <option value="">所有状态</option>
          <option value="RUN_STATUS_SUCCESS">成功</option>
          <option value="RUN_STATUS_FAILED">失败</option>
          <option value="RUN_STATUS_TIMEOUT">超时</option>
          <option value="RUN_STATUS_CANCELED">已取消</option>
          <option value="RUN_STATUS_RUNNING">执行中</option>
          <option value="RUN_STATUS_DISPATCH_FAIL">派发失败</option>
        </select>
        <input
          className="ui-input"
          style={{ width: 200 }}
          placeholder="按任务名过滤"
          value={draftJob}
          onChange={(e) => setDraftJob(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
        <input
          className="ui-input"
          style={{ width: 220 }}
          placeholder="业务键模糊匹配…"
          value={draftBiz}
          onChange={(e) => setDraftBiz(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
        <button type="button" className="ui-btn ui-btn-primary" onClick={apply}>
          <Search className="h-3.5 w-3.5" />
          搜索
        </button>
        <button type="button" className="ui-btn ui-btn-default" onClick={reset}>
          重置
        </button>
      </div>

      {q.isLoading ? (
        <EmptyRow text="加载中…" />
      ) : q.error ? (
        <EmptyRow text={extractError(q.error)} danger />
      ) : !q.data || q.data.runs.length === 0 ? (
        <EmptyRow text="没有匹配的运行记录" />
      ) : (
        <>
          <table className="ui-tbl">
            <thead>
              <tr>
                <th>运行 ID</th>
                <th>任务</th>
                <th>状态</th>
                <th>Worker</th>
                <th>开始时间</th>
                <th>耗时</th>
                <th>重试</th>
                <th className="pr-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.runs.map((r) => (
                <tr
                  key={r.run_id}
                  className="cursor-pointer"
                  onClick={() => onOpenDetail(r.run_id)}
                >
                  <td>
                    <code className="text-[12px]">{r.run_id.slice(0, 8)}…</code>
                  </td>
                  <td>
                    <span className="font-medium">{r.job_name}</span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.worker_id || '-'}</td>
                  <td className="text-fg-muted">
                    {r.started_at > 0
                      ? formatUnix(Math.floor(r.started_at / 1000))
                      : formatUnix(r.created_at)}
                  </td>
                  <td>{r.duration_ms > 0 ? formatDuration(r.duration_ms) : '-'}</td>
                  <td>
                    {r.retry_count > 0 ? (
                      <span className="font-medium text-warning">{r.retry_count}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="pr-4 text-right">
                    <button
                      type="button"
                      className="ui-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(r.run_id);
                      }}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
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
        </>
      )}
    </>
  );
}

// ============== 派发失败 tab ==============
function FailedTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const q = useQuery({
    queryKey: ['runs', 'dispatch_fail'],
    queryFn: () => runApi.list({ status: 'RUN_STATUS_DISPATCH_FAIL', page_size: 50 }),
    refetchInterval: 15_000,
  });

  return (
    <>
      <div className="m-4 flex items-start gap-2.5 rounded-md border border-red-100 bg-danger-bg p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" />
        <div className="text-[13px]">
          <strong className="text-[#B91C1C]">
            {q.data?.runs.length ?? 0} 条派发失败需要关注
          </strong>
          <div className="mt-0.5 text-[12px] text-[#B91C1C]/80">
            通常因 Worker 全部下线 / 任务并发已满 / 应用 QPS 配额耗尽
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <EmptyRow text="加载中…" />
      ) : q.error ? (
        <EmptyRow text={extractError(q.error)} danger />
      ) : !q.data || q.data.runs.length === 0 ? (
        <EmptyRow text="暂无派发失败记录" />
      ) : (
        <table className="ui-tbl">
          <thead>
            <tr>
              <th>运行 ID</th>
              <th>任务</th>
              <th>失败原因</th>
              <th>失败时间</th>
              <th className="pr-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {q.data.runs.map((r) => (
              <tr
                key={r.run_id}
                className="cursor-pointer"
                onClick={() => onOpenDetail(r.run_id)}
              >
                <td>
                  <code className="text-[12px]">{r.run_id.slice(0, 8)}…</code>
                </td>
                <td>
                  <span className="font-medium">{r.job_name}</span>
                </td>
                <td>
                  <span className="text-[12.5px] text-danger">{r.error || 'unknown'}</span>
                </td>
                <td className="text-fg-muted">{formatUnix(r.created_at)}</td>
                <td className="pr-4 text-right">
                  <button
                    type="button"
                    className="ui-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(r.run_id);
                    }}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function EmptyRow({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div
      className={`px-4 py-12 text-center text-[13px] ${danger ? 'text-danger' : 'text-fg-muted'}`}
    >
      {text}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

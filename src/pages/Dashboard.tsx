import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListTodo, Activity, AlertTriangle, Server, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { dashboardApi, extractError } from '@/lib/api';
import type { GetDashboardResponse, JobMetricRow, TimePoint } from '@/types/api';

export default function DashboardPage() {
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(24),
    refetchInterval: 30_000,
  });

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">概览</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            实时调度状态与历史趋势 · 自动刷新 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="ui-input w-36 h-9 text-[13px]">
            <option>最近 24h</option>
            <option>最近 7 天</option>
            <option>最近 30 天</option>
          </select>
        </div>
      </div>

      {q.isLoading ? (
        <div className="ui-card flex h-64 items-center justify-center">
          <div className="text-[13px] text-fg-muted">加载中...</div>
        </div>
      ) : q.error ? (
        <div className="ui-card flex h-64 items-center justify-center">
          <div className="text-[13px] text-danger">{extractError(q.error)}</div>
        </div>
      ) : q.data ? (
        <DashboardContent d={q.data} />
      ) : null}
    </>
  );
}

function DashboardContent({ d }: { d: GetDashboardResponse }) {
  const latestFailRate = d.fail_rate_trend?.length
    ? d.fail_rate_trend[d.fail_rate_trend.length - 1].rate
    : 0;
    
  return (
    <div className="space-y-6">
      {/* KPI 卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="总任务数"
          value={d.total_jobs}
          icon={<ListTodo className="h-5 w-5" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
          trend={+5.2}
        />
        <KpiCard
          label="今日运行"
          value={d.today_runs}
          icon={<Activity className="h-5 w-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
          trend={+12.3}
        />
        <KpiCard
          label="今日失败"
          value={d.today_failed}
          valueDanger={d.today_failed > 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-400"
          trend={d.today_failed > 0 ? -8.1 : 0}
        />
        <KpiCard
          label="在线 Worker"
          customValue={
            <div className="flex items-baseline gap-1">
              <span className={d.online_workers === d.total_workers ? 'text-emerald-400' : 'text-amber-400'}>
                {d.online_workers}
              </span>
              <span className="text-lg font-medium text-fg-subtle">/ {d.total_workers}</span>
            </div>
          }
          icon={<Server className="h-5 w-5" />}
          iconBg="bg-violet-500/10"
          iconColor="text-violet-400"
          footer={
            <div className="flex items-center gap-2 text-[12px]">
              <span
                className={`ui-dot ${d.online_workers === d.total_workers ? 'ui-dot-success' : 'ui-dot-warning'}`}
                style={{ width: 6, height: 6 }}
              />
              <span className="text-fg-muted">
                {d.online_workers === d.total_workers
                  ? '全部健康'
                  : `${d.total_workers - d.online_workers} 个离线`}
              </span>
            </div>
          }
        />
      </div>

      {/* 趋势图表区 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="ui-card col-span-2 p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-fg">运行数趋势</h3>
              <p className="mt-1 text-[12px] text-fg-muted">
                最近 24 小时 · 按小时聚合
              </p>
            </div>
            <div className="flex items-center gap-4 text-[12px]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                成功
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                失败
              </span>
            </div>
          </div>
          <RunsTrendChart points={d.runs_trend ?? []} />
        </div>

        <div className="ui-card p-6">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-fg">失败率</h3>
            <p className="mt-1 text-[12px] text-fg-muted">警戒线 1%</p>
          </div>
          <div className="mb-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-fg">
              {(latestFailRate * 100).toFixed(2)}
            </span>
            <span className="mb-1 text-lg text-fg-muted">%</span>
          </div>
          <span className={`ui-badge ${latestFailRate < 0.01 ? 'ui-badge-success' : 'ui-badge-warning'}`}>
            {latestFailRate < 0.01 ? '健康' : '需关注'}
          </span>
          <FailRateChart points={d.fail_rate_trend ?? []} />
        </div>
      </div>

      {/* Top 榜单 */}
      <div className="grid grid-cols-3 gap-4">
        <TopCard
          title="最近失败 Top 5"
          linkTo="/runs"
          rows={d.recent_failed_top ?? []}
          badgeClass="ui-badge-danger"
          emptyText="近期无失败任务"
        />
        <TopCard
          title="派发失败 Top"
          linkTo="/runs"
          rows={d.dispatch_failed_top ?? []}
          badgeClass="ui-badge-warning"
          emptyText="所有任务派发正常"
          showHealthyHint
        />
        <TopCard
          title="当前 inflight Top 5"
          linkTo="/runs"
          rows={d.inflight_top ?? []}
          badgeClass="ui-badge-info"
          emptyText="当前没有在执行的任务"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  customValue,
  valueDanger,
  icon,
  iconBg,
  iconColor,
  footer,
  trend,
}: {
  label: string;
  value?: number;
  customValue?: React.ReactNode;
  valueDanger?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  footer?: React.ReactNode;
  trend?: number;
}) {
  return (
    <div className="ui-card ui-card-hover p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-[12px] ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="mb-1 text-[12px] font-medium text-fg-muted">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${valueDanger ? 'text-red-400' : 'text-fg'}`}>
        {customValue ?? formatNumber(value ?? 0)}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function RunsTrendChart({ points }: { points: TimePoint[] }) {
  const paths = useMemo(() => buildTrendPaths(points), [points]);

  if (paths.empty) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-fg-muted">
        暂无数据
      </div>
    );
  }

  return (
    <>
      <svg viewBox="0 0 720 200" className="h-[200px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="successGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 网格线 */}
        <line x1="0" y1="50" x2="720" y2="50" stroke="var(--color-border)" strokeOpacity="0.5" />
        <line x1="0" y1="100" x2="720" y2="100" stroke="var(--color-border)" strokeOpacity="0.5" />
        <line x1="0" y1="150" x2="720" y2="150" stroke="var(--color-border)" strokeOpacity="0.5" />
        <line x1="0" y1="200" x2="720" y2="200" stroke="var(--color-border)" strokeOpacity="0.8" />
        {/* 成功面积 + 线 */}
        <path d={paths.successArea} fill="url(#successGradient)" />
        <path d={paths.successLine} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {/* 失败线 */}
        <path d={paths.failedLine} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" />
      </svg>
      <div className="mt-3 flex justify-between text-[11px] text-fg-subtle">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>现在</span>
      </div>
    </>
  );
}

function buildTrendPaths(points: TimePoint[]) {
  if (!points || points.length === 0) {
    return { empty: true, successLine: '', successArea: '', failedLine: '' };
  }
  const w = 720;
  const yTop = 20;
  const yBot = 180;
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.success, p.failed)));
  const xStep = points.length === 1 ? 0 : w / (points.length - 1);
  const toXY = (idx: number, v: number) => {
    const x = idx * xStep;
    const y = yBot - ((yBot - yTop) * v) / maxVal;
    return [x, y] as const;
  };
  const linePath = (key: 'success' | 'failed') =>
    points
      .map((p, i) => {
        const [x, y] = toXY(i, p[key]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  const successLine = linePath('success');
  const area = `${successLine} L${w},${yBot} L0,${yBot} Z`;
  return {
    empty: false,
    successLine,
    successArea: area,
    failedLine: linePath('failed'),
  };
}

function FailRateChart({ points }: { points: TimePoint[] }) {
  const path = useMemo(() => {
    if (!points || points.length === 0) return '';
    const w = 280;
    const yTop = 10;
    const yBot = 90;
    const maxRate = Math.max(0.02, ...points.map((p) => p.rate || 0));
    const xStep = points.length === 1 ? 0 : w / (points.length - 1);
    return points
      .map((p, i) => {
        const x = i * xStep;
        const y = yBot - ((yBot - yTop) * (p.rate || 0)) / maxRate;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);

  if (!path) {
    return <div className="mt-4 h-[100px]" />;
  }
  return (
    <svg viewBox="0 0 280 100" className="mt-4 h-[100px] w-full" preserveAspectRatio="none">
      {/* 警戒线 1% */}
      <line x1="0" y1="40" x2="280" y2="40" stroke="var(--color-danger)" strokeOpacity="0.3" strokeDasharray="4,3" strokeWidth="1" />
      <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2" />
    </svg>
  );
}

function TopCard({
  title,
  linkTo,
  rows,
  badgeClass,
  emptyText,
  showHealthyHint,
}: {
  title: string;
  linkTo: string;
  rows: JobMetricRow[];
  badgeClass: string;
  emptyText: string;
  showHealthyHint?: boolean;
}) {
  const hasData = rows && rows.length > 0;
  return (
    <div className="ui-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
        <Link to={linkTo} className="flex items-center gap-1 text-[12px] text-fg-muted transition hover:text-accent">
          查看全部 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {hasData ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.job_name}
              className="flex items-center justify-between rounded-lg bg-bg-muted px-3 py-2.5"
            >
              <span className="text-[13px] font-medium text-fg">{r.job_name}</span>
              <span className={`ui-badge ${badgeClass}`}>{r.count}</span>
            </div>
          ))}
        </div>
      ) : showHealthyHint ? (
        <div className="flex flex-col items-center justify-center py-8 text-fg-subtle">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <span className="text-xl text-emerald-400">✓</span>
          </div>
          <span className="text-[12px]">{emptyText}</span>
        </div>
      ) : (
        <div className="py-8 text-center text-[12px] text-fg-subtle">{emptyText}</div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n);
}

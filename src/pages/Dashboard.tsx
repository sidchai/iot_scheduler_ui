import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListTodo, Activity, AlertTriangle, Server } from 'lucide-react';
import { dashboardApi, extractError } from '@/lib/api';
import type { GetDashboardResponse, JobMetricRow, TimePoint } from '@/types/api';

/**
 * 概览页（Dashboard）。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html L322-L504：
 *   - 顶部 4 张 KPI 卡：总任务数 / 今日运行 / 今日失败 / 在线 Worker
 *   - 中部 2:1 趋势区：左侧"运行数趋势"（成功/失败双线 + 面积填充），右侧"失败率"小卡
 *   - 底部 3 列 Top 榜：最近失败 / 派发失败 / 当前 inflight
 *   - 30s 自动刷新
 *
 * 数据源：后端 scheduler.GetDashboard RPC，已聚合好。
 * 失败率：从 fail_rate_trend 最新点取 rate；失败率<1% 显示绿色徽章。
 */
export default function DashboardPage() {
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(24),
    refetchInterval: 30_000,
  });

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">概览</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            实时调度状态与历史趋势 · 数据自动刷新 30s
          </p>
        </div>
        <button type="button" className="ui-btn ui-btn-default">最近 24h</button>
      </div>

      {q.isLoading ? (
        <div className="ui-card p-10 text-center text-[13px] text-fg-muted">加载中…</div>
      ) : q.error ? (
        <div className="ui-card p-10 text-center text-[13px] text-danger">
          {extractError(q.error)}
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
    <>
      {/* === KPI 4 卡 === */}
      <div className="mb-5 grid grid-cols-4 gap-4">
        <KpiCard
          label="总任务数"
          value={d.total_jobs}
          icon={<ListTodo className="h-4 w-4 text-zinc-600" />}
          iconBg="bg-zinc-100"
        />
        <KpiCard
          label="今日运行"
          value={d.today_runs}
          icon={<Activity className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <KpiCard
          label="今日失败"
          value={d.today_failed}
          valueDanger={d.today_failed > 0}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          iconBg="bg-red-50"
        />
        <KpiCard
          label="在线 Worker"
          customValue={
            <>
              <span className={d.online_workers === d.total_workers ? 'text-success' : 'text-warning'}>
                {d.online_workers}
              </span>
              <span className="text-[18px] font-medium text-fg-subtle"> / {d.total_workers}</span>
            </>
          }
          icon={<Server className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          footer={
            <div className="flex items-center gap-1.5 text-[12px]">
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

      {/* === 趋势区：2:1 grid === */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="ui-card col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold">运行数趋势</h3>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                最近 24 小时 · 按小时聚合
              </p>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
                成功
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                失败
              </span>
            </div>
          </div>
          <RunsTrendChart points={d.runs_trend ?? []} />
        </div>

        <div className="ui-card p-5">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold">失败率</h3>
            <p className="mt-0.5 text-[12px] text-fg-muted">警戒 1%</p>
          </div>
          <div className="mb-1 text-[32px] font-semibold leading-none tracking-tight">
            {(latestFailRate * 100).toFixed(2)}
            <span className="text-[18px] text-fg-muted">%</span>
          </div>
          <span
            className={`ui-badge ${latestFailRate < 0.01 ? 'ui-badge-success' : 'ui-badge-warning'}`}
            style={{ padding: '0 5px' }}
          >
            {latestFailRate < 0.01 ? '健康' : '需关注'}
          </span>
          <FailRateChart points={d.fail_rate_trend ?? []} />
        </div>
      </div>

      {/* === 3 列 Top 榜 === */}
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
          badgeClass="ui-badge-danger"
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
    </>
  );
}

// =====================================================================
// KPI Card
// =====================================================================
function KpiCard({
  label,
  value,
  customValue,
  valueDanger,
  icon,
  iconBg,
  footer,
}: {
  label: string;
  value?: number;
  customValue?: React.ReactNode;
  valueDanger?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="ui-card ui-card-hover p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium text-fg-muted">{label}</div>
          <div
            className={`mt-1.5 text-[28px] font-semibold leading-none tracking-tight ${valueDanger ? 'text-danger' : ''}`}
          >
            {customValue ?? formatNumber(value ?? 0)}
          </div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      {footer}
    </div>
  );
}

// =====================================================================
// 运行数趋势 SVG（成功/失败双线 + 面积填充）
// =====================================================================
function RunsTrendChart({ points }: { points: TimePoint[] }) {
  // 用 useMemo 缓存 path 计算（24 个点的 catmull-rom 等价插值）
  const paths = useMemo(() => buildTrendPaths(points), [points]);

  if (paths.empty) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[13px] text-fg-muted">
        暂无数据
      </div>
    );
  }

  return (
    <>
      <svg viewBox="0 0 720 180" className="h-[180px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#18181B" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#18181B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 网格 */}
        <line x1="0" y1="40" x2="720" y2="40" stroke="#F4F4F5" />
        <line x1="0" y1="80" x2="720" y2="80" stroke="#F4F4F5" />
        <line x1="0" y1="120" x2="720" y2="120" stroke="#F4F4F5" />
        <line x1="0" y1="160" x2="720" y2="160" stroke="#E4E4E7" />
        {/* 成功 area + line */}
        <path d={paths.successArea} fill="url(#g1)" />
        <path d={paths.successLine} fill="none" stroke="#18181B" strokeWidth="1.8" />
        {/* 失败 line */}
        <path d={paths.failedLine} fill="none" stroke="#EF4444" strokeWidth="1.5" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-fg-subtle">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>现在</span>
      </div>
    </>
  );
}

/**
 * 把时间点序列变成 SVG path：
 *  - 横坐标：均分到 [0, 720]
 *  - 纵坐标：success/failed 各自按全局 max 归一化到 [160, 20]（颠倒因 SVG y 向下）
 *  - area = success line + 闭合到 y=160 底边
 */
function buildTrendPaths(points: TimePoint[]) {
  if (!points || points.length === 0) {
    return { empty: true, successLine: '', successArea: '', failedLine: '' };
  }
  const w = 720;
  const yTop = 20;
  const yBot = 160;
  // 找成功/失败合并最大值（避免失败曲线被压扁到看不见）
  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.success, p.failed)),
  );
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

// =====================================================================
// 失败率小图（黄色折线 + 警戒线）
// =====================================================================
function FailRateChart({ points }: { points: TimePoint[] }) {
  const path = useMemo(() => {
    if (!points || points.length === 0) return '';
    const w = 280;
    const yTop = 10;
    const yBot = 90;
    // y 轴最大固定为 max(0.02, 数据最大) → 让小波动也可见
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
      {/* 警戒线 1% 位置（y = 90 - (90-10) * 0.01/maxRate） */}
      <line x1="0" y1="40" x2="280" y2="40" stroke="#FECACA" strokeDasharray="4,3" strokeWidth="1" />
      <path d={path} fill="none" stroke="#F59E0B" strokeWidth="1.8" />
    </svg>
  );
}

// =====================================================================
// Top 榜单卡片
// =====================================================================
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
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <Link to={linkTo} className="ui-link text-[12px]">
          查看全部 →
        </Link>
      </div>
      {hasData ? (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.job_name}
              className="flex items-center justify-between py-1"
            >
              <span className="text-[13px] font-medium">{r.job_name}</span>
              <span className={`ui-badge ${badgeClass}`}>{r.count}</span>
            </div>
          ))}
        </div>
      ) : showHealthyHint ? (
        <div className="flex flex-col items-center justify-center py-6 text-fg-subtle">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <span className="text-[18px] leading-none text-emerald-600">✓</span>
          </div>
          <span className="text-[12px]">{emptyText}</span>
        </div>
      ) : (
        <div className="py-6 text-center text-[12px] text-fg-subtle">{emptyText}</div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  // 千分位分隔，与原型 "12,346" 对齐
  return new Intl.NumberFormat('en-US').format(n);
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn 是 shadcn/ui 体系的标准辅助：clsx + tailwind-merge
 * 用于合并 className，自动去重冲突的 tw 类（如 `p-2` 和 `p-4` 同时出现取后者）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 把 Unix 秒级时间戳格式化为 'YYYY-MM-DD HH:mm:ss'；0/负值返回 '-'。
 *
 * 全部后端时间字段统一秒级（与 sched_* 表 BIGINT 字段对齐），UI 不参与时区转换，
 * 浏览器按本地时区展示即可。
 */
export function formatUnix(ts?: number | null): string {
  if (!ts || ts <= 0) return '-';
  const d = new Date(ts * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 相对时间："3 分钟前 / 2 小时前 / 5 天前 / 2026-01-02"，1 周以上回退到绝对日期。
 *
 * 用于审计日志 / 运行记录列表，比绝对时间更直观。
 */
export function relativeTime(ts?: number | null): string {
  if (!ts || ts <= 0) return '-';
  const diffSec = Math.floor(Date.now() / 1000) - ts;
  if (diffSec < 60) return `${diffSec} 秒前`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)} 天前`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

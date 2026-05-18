import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Repeat,
  Calendar,
  Zap,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { appApi, jobApi, extractError } from '@/lib/api';
import type { ExecuteMode, Job, Priority, TriggerType } from '@/types/api';

/**
 * Job 创建/编辑表单 · 4 步向导。
 *
 * 视觉对齐 docs/rfc/05_ui_prototype.html L1254-L1456：
 *   - 顶部步骤条（基础 → 执行 → 调度 → 告警）
 *   - 内容区按 step 切换；每步只问相关字段，降低单屏密度
 *   - 底部"上一步 / 下一步 / 完成"
 *
 * 字段分组：
 *   Step 1（基础）：job_name / app_name / description / priority / critical
 *   Step 2（执行）：execute_mode / shard_total / timeout_seconds / max_inflight / retry_max / retry_backoff
 *   Step 3（调度）：trigger_type + 对应字段（cron_expr / fixed_rate_seconds / one_time_at / timezone）
 *   Step 4（告警）：信息卡说明（告警绑定在『告警规则』页配置，不在这里管理）
 *
 * 编辑模式：job_name / app_name / trigger_type 三个字段不允许改（会破坏 worker 注册语义）。
 */

const STEPS = ['基础', '执行', '调度', '告警'] as const;

// 后端期望 proto enum 全名字符串（PRIORITY_HIGH/NORMAL/LOW），不是整数。
// 该枚举影响派发队列顺序（high→normal→low），同优先级 FIFO。
const PRIORITY_OPTIONS: { value: Priority; label: string; hint: string; iconKind: 'high' | 'mid' | 'low' }[] = [
  { value: 'PRIORITY_HIGH', label: '高', hint: '资源优先保障', iconKind: 'high' },
  { value: 'PRIORITY_NORMAL', label: '中', hint: '默认', iconKind: 'mid' },
  { value: 'PRIORITY_LOW', label: '低', hint: '资源紧张时让步', iconKind: 'low' },
];

const TRIGGERS: { value: TriggerType; label: string; hint: string; icon: typeof Clock }[] = [
  { value: 'TRIGGER_TYPE_CRON', label: 'cron', hint: '按 cron 表达式定时', icon: Clock },
  { value: 'TRIGGER_TYPE_FIXED_RATE', label: 'fixed_rate', hint: '固定间隔', icon: Repeat },
  { value: 'TRIGGER_TYPE_ONE_TIME', label: 'one_time', hint: '指定时刻一次', icon: Calendar },
  { value: 'TRIGGER_TYPE_API', label: 'api', hint: '业务方 SubmitTask 触发', icon: Zap },
];

export function JobForm({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job;
}) {
  const isEdit = !!job;
  const qc = useQueryClient();
  const toast = useToast();

  const apps = useQuery({
    queryKey: ['apps', 'forJobForm'],
    queryFn: () => appApi.list(),
    enabled: open && !isEdit,
  });

  // 后端返回已是 proto enum 字符串；UNSPECIFIED 默认归类为 NORMAL（中）
  const initialPriority = useMemo<Priority>(() => {
    const p = job?.priority;
    if (p === 'PRIORITY_HIGH' || p === 'PRIORITY_NORMAL' || p === 'PRIORITY_LOW') return p;
    return 'PRIORITY_NORMAL';
  }, [job]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    job_name: job?.job_name ?? '',
    app_name: job?.app_name ?? '',
    description: job?.description ?? '',
    trigger_type: (job?.trigger_type ?? 'TRIGGER_TYPE_CRON') as TriggerType,
    cron_expr: job?.cron_expr ?? '0 */5 * * * *',
    fixed_rate_seconds: job?.fixed_rate_seconds ?? 60,
    one_time_at: job?.one_time_at ?? 0,
    timezone: job?.timezone ?? 'Asia/Shanghai',
    // 后端期望 proto enum 全名；UNSPECIFIED 默认归类为 SINGLE。
    // 之前错误使用了 'broadcast'/'single' 导致创建时后端解析为 UNSPECIFIED，编辑时也无法回显。
    execute_mode: (job?.execute_mode === 'EXECUTE_MODE_SHARDING'
      ? 'EXECUTE_MODE_SHARDING'
      : 'EXECUTE_MODE_SINGLE') as ExecuteMode,
    // shard_total 在 proto 没在 Job 顶层（在 Dispatch 时使用），UI 这里保留为提示性字段
    timeout_seconds: job?.timeout_seconds ?? 60,
    max_inflight: job?.max_inflight ?? 1,
    retry_max: job?.retry_max ?? 0,
    // 后端期望 JSON int 秒数数组（worker SDK 解析），越界取最后一个值
    retry_backoff: job?.retry_backoff ?? '[1,5,30]',
    enabled: job?.enabled ?? true,
    priority: initialPriority,
    critical: job?.critical ?? false,
  }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Job> = { ...form };
      return isEdit ? jobApi.update(job!.job_name, payload) : jobApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(isEdit ? '任务已更新（critical 任务需复核）' : '任务已创建');
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  if (!open) return null;

  // 每步的字段级校验：通过才允许"下一步"
  const stepValid = (s: number): boolean => {
    if (s === 0) return !!form.job_name.trim() && !!form.app_name.trim();
    if (s === 1) {
      return form.timeout_seconds > 0 && form.max_inflight > 0 && form.retry_max >= 0;
    }
    if (s === 2) {
      if (form.trigger_type === 'TRIGGER_TYPE_CRON') return !!form.cron_expr.trim();
      if (form.trigger_type === 'TRIGGER_TYPE_FIXED_RATE') return form.fixed_rate_seconds > 0;
      // one_time / api 没强制约束
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!stepValid(step)) {
      toast.error('请完成本步骤的必填项');
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // 最后一步 → 提交
      mutation.mutate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[90vh] w-[680px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold">
              {isEdit ? `编辑任务 · ${job!.job_name}` : '新建任务'}
            </h2>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              {isEdit
                ? job!.critical
                  ? '⚠ critical 任务，修改将进入待审核'
                  : '修改任务配置'
                : '通过向导创建一个新的调度任务'}
            </p>
          </div>
          <button
            type="button"
            className="text-fg-muted transition hover:text-fg"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="ui-stepper">
          {STEPS.map((label, i) => (
            <div key={label} className="contents">
              <div
                className={`ui-stepper-item ${i === step ? 'active' : i < step ? 'done' : ''}`}
              >
                <div className="ui-stepper-circle">{i < step ? '✓' : i + 1}</div>
                {label}
              </div>
              {i < STEPS.length - 1 && <div className="ui-stepper-line" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <Step1
              form={form}
              setForm={setForm}
              isEdit={isEdit}
              apps={apps.data?.map((a) => a.app_name) ?? []}
            />
          )}
          {step === 1 && <Step2 form={form} setForm={setForm} />}
          {step === 2 && <Step3 form={form} setForm={setForm} isEdit={isEdit} />}
          {step === 3 && <Step4 />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-zinc-50/50 px-6 py-4">
          {step > 0 ? (
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              上一步
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="ui-btn ui-btn-default"
              onClick={() => onOpenChange(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={mutation.isPending}
              onClick={handleNext}
            >
              {step === STEPS.length - 1 ? (
                mutation.isPending ? '提交中…' : isEdit ? '保存' : '创建任务'
              ) : (
                <>
                  下一步
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Step 1：基础信息
// =====================================================================
type FormState = Parameters<typeof JobForm>[0] extends infer _ ? never : never; // 占位
type SharedProps = {
  // 用 ReturnType 反推，避免重复定义 form 字段类型
  form: ReturnType<typeof useFormPlaceholder>;
  setForm: (s: ReturnType<typeof useFormPlaceholder>) => void;
};
function useFormPlaceholder() {
  // 仅作类型推导锚点；实际不会被调用
  return {
    job_name: '' as string,
    app_name: '' as string,
    description: '' as string,
    trigger_type: 'TRIGGER_TYPE_CRON' as TriggerType,
    cron_expr: '' as string,
    fixed_rate_seconds: 0,
    one_time_at: 0,
    timezone: '' as string,
    execute_mode: 'EXECUTE_MODE_SINGLE' as ExecuteMode,
    timeout_seconds: 0,
    max_inflight: 0,
    retry_max: 0,
    retry_backoff: '' as string,
    enabled: true as boolean,
    priority: 'PRIORITY_NORMAL' as Priority,
    critical: false as boolean,
  };
}
void useFormPlaceholder; // 不引发 unused 警告
void ({} as FormState);

function Step1({
  form,
  setForm,
  isEdit,
  apps,
}: SharedProps & { isEdit: boolean; apps: string[] }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="ui-label">
          jobName <span className="text-danger">*</span>
        </label>
        <input
          className="ui-input"
          disabled={isEdit}
          value={form.job_name}
          onChange={(e) => setForm({ ...form, job_name: e.target.value })}
          placeholder="callback_record"
        />
        <div className="ui-desc mt-1.5 flex items-start gap-1.5">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-warning" />
          创建后不可修改，必须与代码 RegisterHandler 一致
        </div>
      </div>

      <div>
        <label className="ui-label">
          所属应用 <span className="text-danger">*</span>
        </label>
        {isEdit ? (
          <input className="ui-input" value={form.app_name} disabled />
        ) : (
          <select
            className="ui-input"
            value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
          >
            <option value="">请选择应用…</option>
            {apps.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="ui-label">任务描述</label>
        <textarea
          className="ui-input"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="一句话描述这个任务做什么"
        />
      </div>

      <div>
        <label className="ui-label">
          优先级 <span className="text-danger">*</span>
        </label>
        <div className="ui-desc mb-1.5 flex items-start gap-1.5">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-fg-muted" />
          仅影响派发顺序：高优先任务先派给 Worker，同优先级按创建时间先后；不影响并发上限，也不会抢占已在跑的任务
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITY_OPTIONS.map((p) => {
            const selected = form.priority === p.value;
            const Icon =
              p.iconKind === 'high' ? ArrowUp : p.iconKind === 'low' ? ArrowDown : Minus;
            const iconColor =
              p.iconKind === 'high'
                ? 'text-danger'
                : p.iconKind === 'low'
                  ? 'text-blue-500'
                  : 'text-fg-muted';
            return (
              <label
                key={p.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md p-3 transition ${
                  selected
                    ? 'border-2 border-primary'
                    : 'border border-border hover:border-primary'
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  className="mt-0.5"
                  checked={selected}
                  onChange={() => setForm({ ...form, priority: p.value })}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-fg-muted">{p.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 transition hover:bg-hover">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.critical}
          onChange={(e) => setForm({ ...form, critical: e.target.checked })}
        />
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            标记为高敏任务（critical）
          </div>
          <div className="mt-0.5 text-[12px] text-fg-muted">
            勾选后所有改动需双人复核（Admin × 2）
          </div>
        </div>
      </label>
    </div>
  );
}

// =====================================================================
// Step 2：执行策略
// =====================================================================
function Step2({ form, setForm }: SharedProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="ui-label">
          执行模式 <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['EXECUTE_MODE_SINGLE', 'EXECUTE_MODE_SHARDING'] as const).map((m) => {
            const selected = form.execute_mode === m;
            const isSingle = m === 'EXECUTE_MODE_SINGLE';
            return (
              <label
                key={m}
                className={`cursor-pointer rounded-md p-3 transition ${
                  selected
                    ? 'border-2 border-primary'
                    : 'border border-border hover:border-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="execute_mode"
                    checked={selected}
                    onChange={() => setForm({ ...form, execute_mode: m })}
                  />
                  <span className="text-[13px] font-medium">
                    {isSingle ? '单机' : '广播/分片'}
                  </span>
                </div>
                <div className="ml-6 mt-1 text-[11.5px] text-fg-muted">
                  {isSingle
                    ? '同一时刻仅一个 worker 执行'
                    : '所有 worker 都收到，按业务键 hash 分片'}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="ui-label">
            单次超时（秒）<span className="text-danger">*</span>
          </label>
          <input
            className="ui-input"
            type="number"
            min={1}
            value={form.timeout_seconds}
            onChange={(e) =>
              setForm({ ...form, timeout_seconds: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="ui-label">
            最大并发 max_inflight <span className="text-danger">*</span>
          </label>
          <input
            className="ui-input"
            type="number"
            min={1}
            value={form.max_inflight}
            onChange={(e) =>
              setForm({ ...form, max_inflight: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="ui-label">
            失败重试次数 <span className="text-danger">*</span>
          </label>
          <input
            className="ui-input"
            type="number"
            min={0}
            value={form.retry_max}
            onChange={(e) => setForm({ ...form, retry_max: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="ui-label">退避秒数（JSON 数组）</label>
          <input
            className="ui-input"
            value={form.retry_backoff}
            onChange={(e) => setForm({ ...form, retry_backoff: e.target.value })}
            placeholder="[1,5,30]"
          />
          <div className="ui-desc mt-1">越界时取最后一个，例 [1,5,30]</div>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        <span className="text-[13px] font-medium">启用任务（取消勾选 = 暂停）</span>
      </label>
    </div>
  );
}

// =====================================================================
// Step 3：调度（触发方式 + 对应字段）
// =====================================================================
function Step3({
  form,
  setForm,
  isEdit,
}: SharedProps & { isEdit: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="ui-label">
          触发类型 <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((t) => {
            const selected = form.trigger_type === t.value;
            const Icon = t.icon;
            return (
              <label
                key={t.value}
                className={`cursor-pointer rounded-md p-3 transition ${
                  selected
                    ? 'border-2 border-primary'
                    : 'border border-border hover:border-primary'
                } ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="trigger_type"
                    disabled={isEdit}
                    checked={selected}
                    onChange={() => setForm({ ...form, trigger_type: t.value })}
                  />
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">{t.label}</span>
                </div>
                <div className="ml-7 mt-1 text-[11.5px] text-fg-muted">{t.hint}</div>
              </label>
            );
          })}
        </div>
        {isEdit && (
          <div className="ui-desc mt-1.5 flex items-start gap-1.5">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-warning" />
            触发类型不可修改（想换类型请删了重建）
          </div>
        )}
      </div>

      {/* 触发类型对应的字段 */}
      {form.trigger_type === 'TRIGGER_TYPE_CRON' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ui-label">
              Cron 表达式 <span className="text-danger">*</span>
            </label>
            <input
              className="ui-input"
              value={form.cron_expr}
              onChange={(e) => setForm({ ...form, cron_expr: e.target.value })}
              placeholder="0 */5 * * * *"
            />
            <div className="ui-desc mt-1">6 段：秒 分 时 日 月 周</div>
          </div>
          <div>
            <label className="ui-label">时区</label>
            <input
              className="ui-input"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
        </div>
      )}

      {form.trigger_type === 'TRIGGER_TYPE_FIXED_RATE' && (
        <div>
          <label className="ui-label">
            固定间隔（秒）<span className="text-danger">*</span>
          </label>
          <input
            className="ui-input"
            type="number"
            min={1}
            value={form.fixed_rate_seconds}
            onChange={(e) =>
              setForm({ ...form, fixed_rate_seconds: Number(e.target.value) || 0 })
            }
          />
        </div>
      )}

      {form.trigger_type === 'TRIGGER_TYPE_ONE_TIME' && (
        <div>
          <label className="ui-label">执行时间（Unix 秒）</label>
          <input
            className="ui-input"
            type="number"
            min={0}
            value={form.one_time_at}
            onChange={(e) =>
              setForm({ ...form, one_time_at: Number(e.target.value) || 0 })
            }
          />
          <div className="ui-desc mt-1">0 = 不调度，待手动触发</div>
        </div>
      )}

      {form.trigger_type === 'TRIGGER_TYPE_API' && (
        <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 p-3.5 text-[13px] text-blue-700">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            由业务方代码调用{' '}
            <code className="rounded border border-blue-200 bg-white px-1 py-0.5 text-[12px]">
              SubmitTask
            </code>{' '}
            触发，无需 cron 表达式。
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Step 4：告警（仅信息提示，绑定在告警规则页操作）
// =====================================================================
function Step4() {
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-[13px] text-blue-700">
        <div className="mb-2 flex items-center gap-1.5 font-medium">
          <Info className="h-4 w-4" />
          告警绑定独立管理
        </div>
        <div className="text-[12.5px] leading-relaxed">
          告警规则与通道的绑定通过『告警规则』+『告警通道』+『告警绑定』三个页面集中管理，
          保存任务后请前往这些页面创建绑定。
        </div>
      </div>
      <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4 text-[13px] text-emerald-700">
        <div className="mb-1.5 font-medium">✓ 完成步骤检查</div>
        <ul className="space-y-1 text-[12.5px] leading-relaxed">
          <li>· 基础信息、执行策略、调度方式已填写</li>
          <li>· 点击下方"创建任务"完成提交</li>
          <li>· critical 任务的修改会进入双人审批队列</li>
        </ul>
      </div>
    </div>
  );
}

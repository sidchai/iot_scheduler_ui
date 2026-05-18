import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { alertApi, extractError } from '@/lib/api';
import type { AlertConditionType, AlertRule } from '@/types/api';

/**
 * 告警规则表单：创建与编辑共用。
 *
 * threshold 保持字符串，具体单位由 condition_type 决定；前端只给提示，
 * 避免把后端告警条件语义硬编码到页面里。
 */
const CONDITIONS: { value: AlertConditionType; label: string; hint: string }[] = [
  {
    value: 'ALERT_CONDITION_CONSECUTIVE_FAIL',
    label: '连续失败',
    hint: '阈值为失败次数，例如 3',
  },
  { value: 'ALERT_CONDITION_TIMEOUT', label: '执行超时', hint: '阈值为毫秒，例如 60000' },
  { value: 'ALERT_CONDITION_DISPATCH_FAIL', label: '派发失败', hint: '阈值为次数' },
  {
    value: 'ALERT_CONDITION_SUCCESS_RATE_BELOW',
    label: '成功率低于',
    hint: '阈值为百分比，例如 95',
  },
];

export function AlertRuleForm({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: AlertRule;
}) {
  const isEdit = !!rule;
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    rule_name: rule?.rule_name ?? '',
    condition_type: (rule?.condition_type ??
      'ALERT_CONDITION_CONSECUTIVE_FAIL') as AlertConditionType,
    threshold: rule?.threshold ?? '3',
    window_seconds: rule?.window_seconds ?? 300,
    silence_seconds: rule?.silence_seconds ?? 600,
    escalate_after: rule?.escalate_after ?? 0,
    escalate_to: rule?.escalate_to ?? 0,
    enabled: rule?.enabled ?? true,
  }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<AlertRule> = {
        rule_name: form.rule_name,
        condition_type: form.condition_type,
        threshold: form.threshold,
        window_seconds: form.window_seconds,
        silence_seconds: form.silence_seconds,
        escalate_after: form.escalate_after,
        escalate_to: form.escalate_to,
        enabled: form.enabled,
      };
      return isEdit ? alertApi.updateRule(rule.id, payload) : alertApi.createRule(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertRules'] });
      toast.success(isEdit ? '规则已更新' : '规则已创建');
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.rule_name.trim()) return toast.error('rule_name 必填');
    if (!form.threshold.trim()) return toast.error('threshold 必填');
    mutation.mutate();
  };

  const conditionHint = CONDITIONS.find((c) => c.value === form.condition_type)?.hint ?? '';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `编辑规则 · ${rule.rule_name}` : '创建规则'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '提交中…' : isEdit ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="规则名称" required>
          <Input
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
            placeholder="例如：核心任务连续失败"
          />
        </Field>
        <Field label="触发条件" required>
          <Select
            value={form.condition_type}
            onChange={(e) =>
              setForm({
                ...form,
                condition_type: e.target.value as AlertConditionType,
              })
            }
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="阈值" required hint={conditionHint}>
          <Input
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            placeholder="例如 3"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="评估窗口（秒）" hint="0=不限">
            <Input
              type="number"
              min={0}
              value={form.window_seconds}
              onChange={(e) =>
                setForm({ ...form, window_seconds: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="静默期（秒）" hint="同 key 不重复推送">
            <Input
              type="number"
              min={0}
              value={form.silence_seconds}
              onChange={(e) =>
                setForm({ ...form, silence_seconds: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="升级延迟（秒）" hint="0=不升级">
            <Input
              type="number"
              min={0}
              value={form.escalate_after}
              onChange={(e) =>
                setForm({ ...form, escalate_after: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="升级到通道 ID" hint="0=不升级">
            <Input
              type="number"
              min={0}
              value={form.escalate_to}
              onChange={(e) =>
                setForm({ ...form, escalate_to: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          启用此规则
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
        {hint && <span className="ml-2 text-xs text-fg-muted">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { alertApi, jobApi, extractError } from '@/lib/api';

/**
 * 绑定表单：把指定 Job 关联到一组告警规则与通道。
 *
 * 设计：
 * - job_name 用 datalist 自动补全，降低手输错误概率。
 * - rule_id / channel_id 只展示后端返回的可用候选。
 * - 重复绑定由后端唯一约束兜底，前端只透传错误提示。
 */
export function AlertBindingForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const jobs = useQuery({
    queryKey: ['jobs', 'forBinding'],
    queryFn: () => jobApi.list({ page: 1, page_size: 200 }),
    enabled: open,
  });
  const rules = useQuery({
    queryKey: ['alertRules', 'enabledOnly'],
    queryFn: () => alertApi.listRules({ enabled_only: true }),
    enabled: open,
  });
  const channels = useQuery({
    queryKey: ['alertChannels', 'all'],
    queryFn: () => alertApi.listChannels(),
    enabled: open,
  });

  const [form, setForm] = useState({ job_name: '', rule_id: 0, channel_id: 0 });

  const mutation = useMutation({
    mutationFn: () =>
      alertApi.bind({
        job_name: form.job_name.trim(),
        rule_id: form.rule_id,
        channel_id: form.channel_id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertBindings'] });
      qc.invalidateQueries({ queryKey: ['alertRules'] });
      toast.success('绑定已创建');
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.job_name.trim()) return toast.error('请选择 job');
    if (!form.rule_id) return toast.error('请选择规则');
    if (!form.channel_id) return toast.error('请选择通道');
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建绑定"
      description="把 Job 与规则、通道关联，告警评估器会按周期扫描所有启用绑定。"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '提交中…' : '创建'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label>
            Job <span className="ml-1 text-danger">*</span>
            <span className="ml-2 text-xs text-fg-muted">支持自动补全</span>
          </Label>
          <Input
            list="jobs-datalist"
            value={form.job_name}
            onChange={(e) => setForm({ ...form, job_name: e.target.value })}
            placeholder="job_name"
          />
          <datalist id="jobs-datalist">
            {jobs.data?.jobs.map((j) => (
              <option key={j.id} value={j.job_name}>
                {j.app_name}
              </option>
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label>
            规则 <span className="ml-1 text-danger">*</span>
          </Label>
          <Select
            value={form.rule_id}
            onChange={(e) => setForm({ ...form, rule_id: Number(e.target.value) })}
          >
            <option value={0}>请选择</option>
            {rules.data?.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} {r.rule_name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            通道 <span className="ml-1 text-danger">*</span>
          </Label>
          <Select
            value={form.channel_id}
            onChange={(e) => setForm({ ...form, channel_id: Number(e.target.value) })}
          >
            <option value={0}>请选择</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} {c.channel_name} ({c.channel_type.replace('ALERT_CHANNEL_', '')})
              </option>
            ))}
          </Select>
        </div>

        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
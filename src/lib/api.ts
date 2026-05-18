import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import type {
  App,
  AlertBinding,
  AlertChannel,
  AlertChannelType,
  AlertRule,
  AuditLog,
  ExportAuditLogsFilter,
  ExportAuditLogsResponse,
  GetDashboardResponse,
  InviteUserRequest,
  Job,
  ListAlertBindingsResponse,
  ListAlertEventsResponse,
  ListAppsResponse,
  ListAuditLogsResponse,
  ListJobsResponse,
  ListPendingChangesResponse,
  ListRunsResponse,
  ListUsersResponse,
  ListWorkersResponse,
  PendingChange,
  Run,
  SsoLoginRequest,
  SsoLoginResponse,
  User,
  UserRole,
} from '@/types/api';

/**
 * axios 实例：所有 API 请求统一走这里。
 *
 * 关键拦截器：
 *   - request：自动注入 Authorization: Bearer <token>
 *   - response 401：自动 logout + 跳 /login（避免无限弹错）
 *
 * 不使用 baseURL（用相对路径），dev 由 vite proxy 转发，prod 由 nginx 同源反代。
 */
export const api = axios.create({
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (err: AxiosError<{ code?: string; message?: string }>) => {
    if (err.response?.status === 401) {
      const { logout } = useAuthStore.getState();
      logout();
      // 避免在 /login 页面重复跳转
      if (!location.pathname.startsWith('/login')) {
        location.assign('/login');
      }
    }
    return Promise.reject(err);
  },
);

/**
 * 把后端错误对象提取成单字符串，UI Toast / alert 用。
 *
 * grpc-gateway 默认错误格式：{"code":<int>,"message":"...","details":[]}
 * 优先取 message，回退到 code，再回退到 axios 通用 message。
 */
export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// =====================================================================
// 按 service 分组的 API 封装
// =====================================================================

export const authApi = {
  ssoLogin: (req: SsoLoginRequest) =>
    api.post<SsoLoginResponse>('/api/v1/auth/ssoLogin', req).then((r) => r.data),
  getMe: () => api.get<User>('/api/v1/users/me').then((r) => r.data),
};

export const appApi = {
  list: (keyword?: string) =>
    api
      .get<ListAppsResponse>('/api/v1/apps', { params: keyword ? { keyword } : undefined })
      .then((r) => r.data.apps),
  get: (appName: string) =>
    api.get<App>(`/api/v1/apps/${encodeURIComponent(appName)}`).then((r) => r.data),
  /**
   * 创建应用。
   * 响应中 app_secret 为明文，仅此一次返回；前端应让用户立即复制保存。
   */
  create: (body: {
    app_name: string;
    owner: string;
    description?: string;
    qps_quota?: number;
    payload_max_bytes?: number;
    webhook_url?: string;
  }) => api.post<{ app: App; app_secret: string }>('/api/v1/apps', body).then((r) => r.data),
  /** 更新可变字段。app_name 不可改。 */
  update: (
    appName: string,
    body: {
      owner?: string;
      description?: string;
      qps_quota?: number;
      payload_max_bytes?: number;
      webhook_url?: string;
    },
  ) =>
    api
      .patch<App>(`/api/v1/apps/${encodeURIComponent(appName)}`, { app_name: appName, ...body })
      .then((r) => r.data),
  /** 重置 app_secret，明文仅此一次返回；confirm 必须等于 app_name 防误触。 */
  resetSecret: (appName: string) =>
    api
      .post<{ app_secret: string }>(`/api/v1/apps/${encodeURIComponent(appName)}:resetSecret`, {
        app_name: appName,
        confirm: appName,
      })
      .then((r) => r.data),
  /** 禁用应用（enabled=0）。 */
  disable: (appName: string) =>
    api
      .post<App>(`/api/v1/apps/${encodeURIComponent(appName)}:disable`, { app_name: appName })
      .then((r) => r.data),
  /** 删除应用；confirm 必须等于 app_name。 */
  remove: (appName: string) =>
    api
      .delete<{ ok: boolean; error?: string }>(
        `/api/v1/apps/${encodeURIComponent(appName)}`,
        { data: { app_name: appName, confirm: appName } },
      )
      .then((r) => r.data),
};

export const jobApi = {
  list: (params?: { app_name?: string; keyword?: string; page?: number; page_size?: number }) =>
    api.get<ListJobsResponse>('/api/v1/jobs', { params }).then((r) => r.data),
  get: (jobName: string) =>
    api.get<Job>(`/api/v1/jobs/${encodeURIComponent(jobName)}`).then((r) => r.data),
  /** 创建 Job：proto CreateJobRequest 是 { job: Job }，整对象包裹一层。 */
  create: (job: Partial<Job>) =>
    api.post<Job>('/api/v1/jobs', { job }).then((r) => r.data),
  /** 更新 Job。critical 任务会触发 pending change（require_approval=true 时）。 */
  update: (jobName: string, job: Partial<Job>) =>
    api
      .patch<Job>(`/api/v1/jobs/${encodeURIComponent(jobName)}`, {
        job: { ...job, job_name: jobName },
      })
      .then((r) => r.data),
  remove: (jobName: string) =>
    api
      .delete<{ ok: boolean; error?: string }>(
        `/api/v1/jobs/${encodeURIComponent(jobName)}`,
        { data: { job_name: jobName, confirm: jobName } },
      )
      .then((r) => r.data),
  pause: (jobName: string) =>
    api
      .post<Job>(`/api/v1/jobs/${encodeURIComponent(jobName)}:pause`, { job_name: jobName })
      .then((r) => r.data),
  resume: (jobName: string) =>
    api
      .post<Job>(`/api/v1/jobs/${encodeURIComponent(jobName)}:resume`, { job_name: jobName })
      .then((r) => r.data),
  /** 手动触发一次 API 触发器；biz_key/payload 为可选幂等键和负载。 */
  trigger: (jobName: string, bizKey?: string) =>
    api
      .post<{ run_id: string }>(
        `/api/v1/jobs/${encodeURIComponent(jobName)}:trigger`,
        { job_name: jobName, biz_key: bizKey || '' },
      )
      .then((r) => r.data),
};

export const runApi = {
  /**
   * 列出运行记录。
   *
   * 注意 status 过滤值必须是 proto enum 全名（RUN_STATUS_SUCCESS 等），
   * 传 lowercase 后端会解析为 UNSPECIFIED 等于不过滤。
   */
  list: (params?: {
    job_name?: string;
    app_name?: string;
    status?: string;
    biz_key_like?: string;
    worker_id?: string;
    since?: number;
    until?: number;
    page?: number;
    page_size?: number;
  }) => api.get<ListRunsResponse>('/api/v1/runs', { params }).then((r) => r.data),
  /** 获取单个 Run 详情（含 payload/output base64）。 */
  get: (runId: string) =>
    api.get<Run>(`/api/v1/runs/${encodeURIComponent(runId)}`).then((r) => r.data),
  /** 取消未完成的 Run。 */
  cancel: (runId: string, reason?: string) =>
    api
      .post<{ ok: boolean; error?: string }>(
        `/api/v1/runs/${encodeURIComponent(runId)}:cancel`,
        { run_id: runId, reason: reason || '' },
      )
      .then((r) => r.data),
  /** 重试失败/超时的 Run；返回新生成的 run_id。 */
  retry: (runId: string) =>
    api
      .post<{ new_run_id: string }>(`/api/v1/runs/${encodeURIComponent(runId)}:retry`, {
        run_id: runId,
      })
      .then((r) => r.data),
};

export const workerApi = {
  list: (params?: { app_name?: string; status?: string }) =>
    api
      .get<ListWorkersResponse>('/api/v1/workers', { params })
      .then((r) => r.data.workers),
  /** 踢下线 worker（强制断连，常用于发版灰度或异常节点处理）。 */
  kick: (workerId: string, reason?: string) =>
    api
      .post<{ ok: boolean; error?: string }>(
        `/api/v1/workers/${encodeURIComponent(workerId)}:kick`,
        { worker_id: workerId, reason: reason || '' },
      )
      .then((r) => r.data),
};

export const userApi = {
  /** 列出所有用户（仅 admin）。 */
  list: (params?: { keyword?: string; role?: UserRole; page?: number; page_size?: number }) =>
    api.get<ListUsersResponse>('/api/v1/users', { params }).then((r) => r.data),
  /** 邀请新用户；返回创建后的 User 行。 */
  invite: (body: InviteUserRequest) =>
    api.post<User>('/api/v1/users:invite', body).then((r) => r.data),
  /** 修改角色（admin / operator / viewer）。 */
  updateRole: (id: number, role: UserRole) =>
    api
      .post<User>(`/api/v1/users/${id}:updateRole`, { id, role })
      .then((r) => r.data),
  /** 禁用用户（不删除，保留审计痕迹）。 */
  disable: (id: number) =>
    api
      .post<{ ok: boolean; error?: string }>(`/api/v1/users/${id}:disable`, { id })
      .then((r) => r.data),
};

export const alertApi = {
  // === 规则 ===
  listRules: (params?: { keyword?: string; enabled_only?: boolean }) =>
    api
      .get<{ rules: AlertRule[] }>('/api/v1/alert/rules', { params })
      .then((r) => r.data.rules),
  /** 创建规则：proto 是 { rule: AlertRule } */
  createRule: (rule: Partial<AlertRule>) =>
    api.post<AlertRule>('/api/v1/alert/rules', { rule }).then((r) => r.data),
  updateRule: (id: number, rule: Partial<AlertRule>) =>
    api
      .patch<AlertRule>(`/api/v1/alert/rules/${id}`, { rule: { ...rule, id } })
      .then((r) => r.data),
  deleteRule: (id: number) =>
    api
      .delete<{ ok: boolean; error?: string }>(`/api/v1/alert/rules/${id}`)
      .then((r) => r.data),

  // === 通道 ===
  listChannels: () =>
    api
      .get<{ channels: AlertChannel[] }>('/api/v1/alert/channels')
      .then((r) => r.data.channels),
  /**
   * 创建通道：
   *   - secret：明文签名密钥（飞书/钉钉加签机器人用），后端服务端加密入库 secret_enc
   *     注意 proto 字段名是 `secret`，不是 `webhook_secret`
   *   - 响应中 webhook_url 为脱敏值（…a8f2），不能直接拿去显示完整地址
   */
  createChannel: (body: {
    channel_name: string;
    channel_type: AlertChannelType;
    webhook_url: string;
    secret?: string;
    template?: string;
    extra_config?: string;
  }) => api.post<AlertChannel>('/api/v1/alert/channels', body).then((r) => r.data),
  /** 更新通道；secret 留空表示不变更（proto 注释规定）。 */
  updateChannel: (
    id: number,
    body: {
      channel_name?: string;
      webhook_url?: string;
      secret?: string;
      template?: string;
      extra_config?: string;
      enabled?: boolean;
    },
  ) =>
    api
      .patch<AlertChannel>(`/api/v1/alert/channels/${id}`, { id, ...body })
      .then((r) => r.data),
  deleteChannel: (id: number) =>
    api
      .delete<{ ok: boolean; error?: string }>(`/api/v1/alert/channels/${id}`)
      .then((r) => r.data),
  /** 真实推送一条测试消息；后端会写回 last_test_at / last_test_ok。 */
  testChannel: (id: number, customMessage?: string) =>
    api
      .post<{ ok: boolean; error?: string; latency_ms: number }>(
        `/api/v1/alert/channels/${id}:test`,
        { id, custom_message: customMessage || '' },
      )
      .then((r) => r.data),

  // === 绑定 ===
  listBindings: (params?: { job_name?: string; rule_id?: number; channel_id?: number }) =>
    api
      .get<ListAlertBindingsResponse>('/api/v1/alert/bindings', { params })
      .then((r) => r.data.bindings),
  bind: (body: { job_name: string; rule_id: number; channel_id: number }) =>
    api.post<AlertBinding>('/api/v1/alert/bindings', body).then((r) => r.data),
  unbind: (id: number) =>
    api
      .delete<{ ok: boolean; error?: string }>(`/api/v1/alert/bindings/${id}`)
      .then((r) => r.data),

  // === 事件流水 ===
  listEvents: (params?: {
    job_name?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) =>
    api
      .get<ListAlertEventsResponse>('/api/v1/alert/events', { params })
      .then((r) => r.data),
  resolveEvent: (id: number, operator: string) =>
    api
      .post<{ ok: boolean; error?: string }>(`/api/v1/alert/events/${id}:resolve`, {
        id,
        operator,
      })
      .then((r) => r.data),
  silenceEvent: (id: number, durationSec: number, operator: string) =>
    api
      .post<{ ok: boolean; silence_until: number }>(`/api/v1/alert/events/${id}:silence`, {
        id,
        duration_sec: durationSec,
        operator,
      })
      .then((r) => r.data),
};

export const auditApi = {
  list: (params?: {
    actor?: string;
    action?: string;
    target_type?: string;
    page?: number;
    page_size?: number;
  }) =>
    api
      .get<ListAuditLogsResponse>('/api/v1/audit/logs', { params })
      .then((r) => r.data),
  /** 查询单条审计日志详情（完整 diff，列表会截断）。 */
  get: (id: number) =>
    api.get<AuditLog>(`/api/v1/audit/logs/${id}`).then((r) => r.data),
  /**
   * 全量导出审计日志：按 filter 同 List，format = "csv" | "json"。
   *
   * 注意 proto 字段名是 `filter`（嵌套 ListAuditLogsRequest）和 `format`，
   * 后端返回 bytes（grpc-gateway 编码为 base64 字符串），调用方负责解码后下载。
   */
  export: (filter: ExportAuditLogsFilter, format: 'csv' | 'json') =>
    api
      .post<ExportAuditLogsResponse>('/api/v1/audit/logs:export', { filter, format })
      .then((r) => r.data),
};

export const pendingChangeApi = {
  /** 列出双人复核改动；status 留空查全部，常用值 pending/approved/rejected/expired。 */
  list: (status?: string) =>
    api
      .get<ListPendingChangesResponse>('/api/v1/pendingChanges', {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data.items),
  /**
   * 批准。后端约定：approver 必须 ≠ proposer（two-man rule），
   * 已登录态下 approver 取自 JWT，传空即可；dev/脚本可显式传。
   */
  approve: (id: number, approver = '') =>
    api
      .post<{ ok: boolean; error?: string }>(
        `/api/v1/pendingChanges/${id}:approve`,
        { id, approver },
      )
      .then((r) => r.data),
  reject: (id: number, reason: string, approver = '') =>
    api
      .post<{ ok: boolean; error?: string }>(
        `/api/v1/pendingChanges/${id}:reject`,
        { id, approver, reason },
      )
      .then((r) => r.data),
};

/**
 * 通用：把后端 bytes（base64 字符串）转 Blob 并触发浏览器下载。
 * 仅在 Audit 导出场景使用，但封装在这里方便复用。
 */
export function downloadBase64(base64: string, contentType: string, filename: string) {
  const bin = atob(base64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  const blob = new Blob([buf], { type: contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 类型占位：避免 import 后 TS 报 "未使用" 警告（PendingChange 类型供页面 import）
export type { PendingChange };

export const dashboardApi = {
  /**
   * 仪表盘聚合数据。
   *
   * 后端 RPC 名：scheduler.GetDashboard，对应 /api/v1/dashboard。
   * window_hours 控制趋势图回溯窗口，默认 24（与原型一致）。
   */
  get: (windowHours?: number) =>
    api
      .get<GetDashboardResponse>('/api/v1/dashboard', {
        params: windowHours ? { window_hours: windowHours } : undefined,
      })
      .then((r) => r.data),
};

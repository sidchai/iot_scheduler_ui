/**
 * 后端 proto 对应的 TypeScript 接口定义。
 *
 * 同步源：iot_architecture/proto/scheduler/v1/scheduler.proto
 * 不做自动生成（量小且更新频率低），手动维护避免 protoc-gen-ts 工具链开销。
 *
 * 命名约定：后端 JSON 字段是 snake_case（由 grpc-gateway protojson UseProtoNames=true 保证），
 * 这里 TS interface 一律 snake_case 对齐，避免一层来回转换。
 */

// =====================================================================
// 通用
// =====================================================================

export type UserRole =
  | 'USER_ROLE_UNSPECIFIED'
  | 'USER_ROLE_ADMIN'
  | 'USER_ROLE_OPERATOR'
  | 'USER_ROLE_VIEWER';

/**
 * TriggerType：与 proto enum 一一对应。
 *
 * grpc-gateway 用 protojson 默认编码 enum 为字符串名（全大写带前缀），
 * 前端创建 Job 时也必须传这种字符串，否则后端解析为 UNSPECIFIED → 入库时 ENUM 列截断。
 */
export type TriggerType =
  | 'TRIGGER_TYPE_UNSPECIFIED'
  | 'TRIGGER_TYPE_CRON'
  | 'TRIGGER_TYPE_FIXED_RATE'
  | 'TRIGGER_TYPE_ONE_TIME'
  | 'TRIGGER_TYPE_API'
  | 'TRIGGER_TYPE_MANUAL'
  | 'TRIGGER_TYPE_RETRY'
  | 'TRIGGER_TYPE_NONE';

// 任务优先级：影响派发顺序（high→normal→low），同优先级 FIFO
export type Priority =
  | 'PRIORITY_UNSPECIFIED'
  | 'PRIORITY_HIGH'
  | 'PRIORITY_NORMAL'
  | 'PRIORITY_LOW';

// 任务执行模式：single=同一时刻仅一个 worker；sharding=广播到所有 worker，按 bizKey hash 分片
export type ExecuteMode =
  | 'EXECUTE_MODE_UNSPECIFIED'
  | 'EXECUTE_MODE_SINGLE'
  | 'EXECUTE_MODE_SHARDING';

export type AlertSeverity =
  | 'ALERT_SEVERITY_UNSPECIFIED'
  | 'ALERT_SEVERITY_INFO'
  | 'ALERT_SEVERITY_WARN'
  | 'ALERT_SEVERITY_ERROR'
  | 'ALERT_SEVERITY_CRITICAL';

export type AlertConditionType =
  | 'ALERT_CONDITION_UNSPECIFIED'
  | 'ALERT_CONDITION_CONSECUTIVE_FAIL'
  | 'ALERT_CONDITION_TIMEOUT'
  | 'ALERT_CONDITION_DISPATCH_FAIL'
  | 'ALERT_CONDITION_SUCCESS_RATE_BELOW';

export type AlertChannelType =
  | 'ALERT_CHANNEL_UNSPECIFIED'
  | 'ALERT_CHANNEL_FEISHU'
  | 'ALERT_CHANNEL_DINGTALK'
  | 'ALERT_CHANNEL_WECOM'
  | 'ALERT_CHANNEL_EMAIL'
  | 'ALERT_CHANNEL_WEBHOOK';

// =====================================================================
// User
// =====================================================================

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  sso_provider: string;
  sso_subject: string; // 已脱敏
  role: UserRole;
  enabled: boolean;
  last_login_at: number;
  created_at: number;
  updated_at: number;
}

export interface SsoLoginRequest {
  provider: string; // 'dev' / 'feishu' / 'dingtalk'
  code: string; // dev 模式 = 'username' 或 'username:display_name'
  state?: string;
}
export interface SsoLoginResponse {
  user: User;
  access_token: string;
  expires_at: number;
}

// =====================================================================
// App
// =====================================================================

export interface App {
  id: number;
  app_name: string;
  app_key: string;
  owner: string;
  description: string;
  enabled: boolean;
  qps_quota: number;
  payload_max_bytes: number;
  webhook_url: string;
  created_at: number;
  updated_at: number;
}

export interface ListAppsResponse {
  apps: App[];
}

// =====================================================================
// Job / Run
// =====================================================================

export interface Job {
  id: number;
  job_name: string;
  app_name: string;
  description: string;
  trigger_type: TriggerType;
  cron_expr: string;
  fixed_rate_seconds: number;
  one_time_at: number;
  timezone: string;
  execute_mode: ExecuteMode;
  timeout_seconds: number;
  max_inflight: number;
  retry_max: number;
  retry_backoff: string;
  enabled: boolean;
  status: string;
  priority: Priority;
  critical: boolean;
  created_at: number;
  updated_at: number;
}

export interface ListJobsResponse {
  jobs: Job[];
  total: number;
}

/**
 * RunStatus：与 proto enum 对齐。
 *
 * 注意：跟 trigger_type 一样，protojson 默认编码为全名字符串，所以
 * 后端 list 返回的 status 字段值是 RUN_STATUS_SUCCESS 这种格式。
 */
export type RunStatus =
  | 'RUN_STATUS_UNSPECIFIED'
  | 'RUN_STATUS_PENDING'
  | 'RUN_STATUS_DISPATCHING'
  | 'RUN_STATUS_DISPATCHED'
  | 'RUN_STATUS_RUNNING'
  | 'RUN_STATUS_SUCCESS'
  | 'RUN_STATUS_FAILED'
  | 'RUN_STATUS_TIMEOUT'
  | 'RUN_STATUS_CANCELED'
  | 'RUN_STATUS_DISPATCH_FAIL';

/**
 * Run：proto Run 完整字段。
 *
 * payload / output 是 bytes，protojson 编码后为 base64 字符串；
 * 前端展示时用 atob 解码（小心 UTF-8）或直接展示 base64 以便排查。
 */
export interface Run {
  run_id: string;
  job_name: string;
  app_name: string;
  biz_key: string;
  payload: string; // base64
  output: string; // base64
  trigger_type: TriggerType;
  trigger_source: string;
  status: RunStatus;
  error: string;
  duration_ms: number;
  worker_id: string;
  shard_index: number;
  shard_total: number;
  retry_count: number;
  parent_run_id: string;
  next_run_at: number;
  trace_id: string;
  span_id: string;
  created_at: number; // 秒
  dispatching_at: number; // 毫秒
  dispatched_at: number; // 毫秒
  started_at: number; // 毫秒
  ended_at: number; // 毫秒
}

export interface ListRunsResponse {
  runs: Run[];
  total: number;
}

// =====================================================================
// Worker
// =====================================================================

/**
 * Worker：proto Worker 完整字段。
 *
 * status 是 string（online/draining/offline），proto 没用 enum；
 * last_heartbeat 是 unix 秒，UI 据此计算"离线 30s 标黄/120s 标红"。
 */
export interface Worker {
  id: number;
  worker_id: string;
  app_name: string;
  instance_id: string;
  ip: string;
  sdk_version: string;
  handler_jobs: string[];
  inflight: number;
  load_avg: number;
  status: 'online' | 'draining' | 'offline';
  connected_at: number; // 秒
  last_heartbeat: number; // 秒
}

export interface ListWorkersResponse {
  workers: Worker[];
}

// =====================================================================
// Dashboard
// =====================================================================

export interface TimePoint {
  ts: number;
  success: number;
  failed: number;
  rate: number;
}

export interface JobMetricRow {
  job_name: string;
  count: number;
}

export interface GetDashboardResponse {
  total_jobs: number;
  today_runs: number;
  today_failed: number;
  online_workers: number;
  total_workers: number;
  runs_trend: TimePoint[];
  fail_rate_trend: TimePoint[];
  recent_failed_top: JobMetricRow[];
  dispatch_failed_top: JobMetricRow[];
  inflight_top: JobMetricRow[];
}

// =====================================================================
// Alert
// =====================================================================

export interface AlertRule {
  id: number;
  rule_name: string;
  condition_type: AlertConditionType;
  threshold: string;
  window_seconds: number;
  silence_seconds: number;
  escalate_after: number;
  escalate_to: number;
  enabled: boolean;
  created_by: string;
  created_at: number;
  updated_at: number;
  binding_count: number;
}

export interface AlertChannel {
  id: number;
  channel_name: string;
  channel_type: AlertChannelType;
  webhook_url: string; // 响应是脱敏后的
  template: string;
  extra_config: string;
  enabled: boolean;
  last_test_at: number;
  last_test_ok: boolean;
  created_at: number;
  updated_at: number;
}

export interface AlertBinding {
  id: number;
  job_name: string;
  rule_id: number;
  channel_id: number;
  enabled: boolean;
  created_at: number;
  rule_name: string;
  channel_name: string;
}

export interface AlertEvent {
  id: number;
  event_key: string;
  job_name: string;
  rule_id: number;
  channel_id: number;
  severity: AlertSeverity;
  summary: string;
  detail: string;
  status: 'firing' | 'resolved' | 'escalated' | 'silenced';
  notified_at: number;
  resolved_at: number;
  silence_until: number;
  created_at: number;
}

export interface ListAlertEventsResponse {
  events: AlertEvent[];
  total: number;
}

export interface ListAlertBindingsResponse {
  bindings: AlertBinding[];
}

// =====================================================================
// Audit
// =====================================================================

export interface AuditLog {
  id: number;
  actor: string;
  actor_ip: string;
  action: string;
  target_type: string;
  target_id: string;
  diff: string;
  request_id: string;
  created_at: number;
}

export interface ListAuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

// =====================================================================
// User 管理（Admin 专用）
// =====================================================================

export interface ListUsersResponse {
  users: User[];
  total: number;
}

export interface InviteUserRequest {
  username: string;
  display_name: string;
  email: string;
  sso_provider?: string;
  sso_subject?: string;
  role: UserRole;
}

// =====================================================================
// PendingChange（双人复核）
// =====================================================================

/**
 * PendingChange：critical 任务变更的待审批快照。
 *
 * - target_type：当前仅 "job"
 * - target_id：业务主键（job_name）
 * - change_diff：JSON 字符串，包裹 {action, job?, reason?} envelope
 * - status：pending / approved / rejected / expired
 * - approver / approved_at：审批后填充
 */
export interface PendingChange {
  id: number;
  target_type: string;
  target_id: string;
  proposer: string;
  proposed_at: number;
  expires_at: number;
  change_diff: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | string;
  approver: string;
  approved_at: number;
}

export interface ListPendingChangesResponse {
  items: PendingChange[];
}

// =====================================================================
// Audit 导出
// =====================================================================

/**
 * ExportAuditLogsRequest：复用 ListAuditLogs 同款 filter，
 * 后端按 filter 全量导出（不分页），返回 csv 或 json 二选一。
 */
export interface ExportAuditLogsFilter {
  actor?: string;
  action?: string;
  target_type?: string;
  target_like?: string;
  since?: number;
  until?: number;
}

export interface ExportAuditLogsResponse {
  // grpc-gateway 编码 bytes 字段为 base64 字符串
  data: string;
  content_type: string;
  filename: string;
}

# iot-scheduler-ui

iot-scheduler 控制台 Web UI（React 19 + TypeScript + Vite）。

## 技术栈

- **构建**：Vite 6 + TypeScript 5.7
- **UI**：React 19 + TailwindCSS 3 + shadcn 风格自维护组件 + lucide-react 图标
- **数据**：TanStack Query v5 + axios（带 Bearer 拦截 + 401 自动跳登录）
- **状态**：Zustand（localStorage 持久化 auth）
- **路由**：React Router v7

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置后端地址（可选，默认 http://localhost:8080）
cp .env.example .env

# 3. 启动 dev server
npm run dev
# → 浏览器打开 http://localhost:5174

# 4. 类型检查 + 构建
npm run type-check
npm run build
```

## 与后端联调

- dev 模式下，vite proxy 把 `/api/*` 与 `/swagger.json` 转发到 `VITE_BACKEND_URL`（默认 `http://localhost:8080`）。
- 登录：首次进入 `/login`，输入 `admin`（后端 bootstrap 自动创建的 admin 账号）即可登录拿到 24h 有效的 access_token。
- token 存在 localStorage `iot-scheduler-auth`；axios 自动注入 `Authorization: Bearer xxx`；401 自动 logout + 跳登录。

## 路由

| 路径 | 状态 |
|---|---|
| `/login` | ✅ dev SSO 登录 |
| `/` | ✅ 仪表盘（统计 + 最近告警） |
| `/apps` | ✅ 应用列表（含搜索） |
| `/jobs` | 🚧 stub |
| `/alerts/rules` | 🚧 stub |
| `/alerts/events` | 🚧 stub |
| `/audit` | 🚧 stub |

## 目录结构

```
src/
├── main.tsx              # 入口（QueryClient + RouterProvider）
├── router.tsx            # 路由表 + ProtectedRoute
├── lib/
│   ├── api.ts            # axios 实例 + 按 service 分组的 API 封装
│   └── utils.ts          # cn / formatUnix / relativeTime
├── stores/
│   └── auth.ts           # Zustand auth store（持久化到 localStorage）
├── types/
│   └── api.ts            # proto 对应的 TypeScript interface
├── components/
│   ├── ui/               # shadcn 风格基础组件（自维护）
│   └── layout/Layout.tsx # 主布局（侧边栏 + 顶部）
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── Apps.tsx
    └── Stub.tsx          # 未实现页面占位
```

## 开发约定

- **JSON 字段命名**：后端走 grpc-gateway `UseProtoNames=true`，所有响应是 `snake_case`；TS interface 与此对齐，零适配层。
- **错误处理**：用 `extractError(err)` 把 axios/grpc-gateway 错误转字符串，UI 直接展示 message。
- **认证状态**：所有数据请求由 `useAuthStore` 提供 token；401 时拦截器自动 logout，无需每页处理。
- **shadcn 风格组件**：手动维护到 `src/components/ui/`，不引入 shadcn CLI，按需新增即可。
```

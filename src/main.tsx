import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { ToastProvider } from '@/components/ui/toast';
import './index.css';

/**
 * 全局 react-query 客户端：
 *   - staleTime 30s：列表数据轻度缓存，切页不必每次重发
 *   - retry 1：网络抖动重试一次；4xx 不重试（react-query 默认行为）
 *   - refetchOnWindowFocus false：避免切回 tab 引爆请求；要刷新让用户点刷新按钮
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

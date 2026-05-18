import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite 配置：
//   - @ 路径别名 → src/，避免冗长的相对路径
//   - dev 代理 /api 与 /swagger.json 到 iot-scheduler 后端（默认 :8080），
//     这样前端 fetch('/api/v1/...') 无需关心跨域和 host 切换
//   - 生产构建固定输出到 dist/，由 nginx 静态托管
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      port: 5174,
      strictPort: false,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/swagger.json': { target: backend, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1024,
    },
  };
});

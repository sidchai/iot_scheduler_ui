/// <reference types="vite/client" />

// 让 tsc 接受 css 副作用 import（vite 在打包时处理为 style 注入）
declare module '*.css';

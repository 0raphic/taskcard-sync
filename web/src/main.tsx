import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, readMode } from './lib/theme';
import './index.css';

// 首帧之前就把主题定下来，避免闪一下深色
applyTheme(readMode());

// 不用 StrictMode：开发下 effect 会跑两遍，PocketBase 的实时订阅也跟着抖
createRoot(document.getElementById('root')!).render(<App />);

// 生产构建里注册离线壳：断网也能看看板（写入仍需要网络）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

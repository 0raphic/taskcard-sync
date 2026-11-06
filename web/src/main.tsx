import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// 不用 StrictMode：开发下 effect 会跑两遍，PocketBase 的实时订阅也跟着抖
createRoot(document.getElementById('root')!).render(<App />);

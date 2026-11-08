import PocketBase from 'pocketbase';

/**
 * 生产环境由 server/index.mjs 同源托管，直接走相对路径；
 * 开发环境由 Vite 的 proxy 把 /api 转到 8090。
 */
export const pb = new PocketBase(window.location.origin);
pb.autoCancellation(false);

export type { RecordModel } from 'pocketbase';

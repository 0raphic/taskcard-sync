import { useCallback, useEffect, useState } from 'react';
import { pb } from './pb';
import type { ShortLink, Task } from './types';

/** 全量任务 + SSE 实时同步：任何一端改了，这里立刻反映 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;

    pb.collection('tasks')
      .getFullList<Task>({ sort: 'created' })
      .then((list) => alive && setTasks(list))
      .catch((e: unknown) => alive && setError(message(e)));

    pb.collection('tasks')
      .subscribe<Task>('*', (e) => {
        setTasks((prev) => {
          if (!prev) return prev;
          if (e.action === 'create') return [...prev, e.record];
          if (e.action === 'delete') return prev.filter((t) => t.id !== e.record.id);
          return prev.map((t) => (t.id === e.record.id ? e.record : t));
        });
      })
      .then((fn) => {
        if (alive) unsub = fn;
        else fn();
      })
      .catch((e: unknown) => alive && setError(message(e)));

    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  return { tasks, error };
}

/** 短码 → 任务（扫码落地页用） */
export function useShortLink(code: string | undefined) {
  const [state, setState] = useState<{
    loading: boolean;
    link?: ShortLink;
    task?: Task;
    error?: string;
    notFound?: boolean;
  }>({ loading: true });

  useEffect(() => {
    if (!code) {
      setState({ loading: false, error: '缺少短码' });
      return;
    }
    let alive = true;
    let linkFound = false;
    let unsubTask: (() => void) | undefined;
    setState({ loading: true });

    pb.collection('short_links')
      .getFirstListItem<ShortLink>(`code="${code}"`, { expand: 'task' })
      .then(async (link) => {
        linkFound = true;
        // 顺手记一次扫码，失败不影响主流程
        pb.collection('short_links')
          .update(link.id, { scans: (link.scans ?? 0) + 1 })
          .catch(() => {});

        const task =
          link.expand?.task ?? (await pb.collection('tasks').getOne<Task>(link.task));
        if (!alive) return;
        setState({ loading: false, link, task });

        // 落地页也要实时：另一台设备改了状态，这里跟着变
        if (alive) {
          pb.collection('tasks')
            .subscribe<Task>(task.id, (e) => {
              if (e.action === 'delete') {
                setState({ loading: false, notFound: true, error: '这张卡已经不在系统里了' });
              } else {
                setState((s) => ({ ...s, task: e.record }));
              }
            })
            .then((fn) => {
              if (alive) unsubTask = fn;
              else fn();
            })
            .catch(() => {});
        }
      })
      .catch((e: unknown) => {
        const status = (e as { status?: number })?.status;
        // 短码本身找不到 = 印错了；短码还在但任务没了 = 被删了
        const deleted = status === 404 && linkFound;
        if (alive) {
          setState({
            loading: false,
            notFound: deleted,
            error: deleted ? '这张卡已经不在系统里了' : status === 404 ? '这个短码不存在，检查一下卡片上的码' : message(e),
          });
        }
      });

    return () => {
      alive = false;
      unsubTask?.();
    };
  }, [code]);

  return state;
}

/** 单条任务 + 它的实时更新 */
export function useTask(id: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    pb.collection('tasks')
      .getOne<Task>(id)
      .then((t) => alive && setTask(t))
      .catch((e: unknown) => alive && setError(message(e)));

    pb.collection('tasks')
      .subscribe<Task>(id, (e) => {
        if (e.action !== 'delete') setTask(e.record);
      })
      .catch(() => {});

    return () => {
      alive = false;
      pb.collection('tasks').unsubscribe(id).catch(() => {});
    };
  }, [id]);

  return { task, error };
}

export function useUpdateTask() {
  return useCallback(async (id: string, patch: Partial<Task>) => {
    const record = await pb.collection('tasks').update<Task>(id, {
      ...patch,
      client_updated_at: new Date().toISOString(),
    });
    return record;
  }, []);
}

export async function createTask(patch: Partial<Task>): Promise<Task> {
  return pb.collection('tasks').create<Task>({
    status: 'todo',
    kind: 'short',
    ...patch,
    client_updated_at: new Date().toISOString(),
  });
}

export async function logProgress(taskId: string, note: string, delta = 0) {
  return pb.collection('progress_logs').create({
    task: taskId,
    note,
    delta,
    at: new Date().toISOString(),
  });
}

/** 删除任务：服务端会连带清掉短链和进展记录（PB 关系不级联） */
export async function deleteTask(id: string) {
  const res = await fetch(`/ds-api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    deleted?: { links: number; logs: number };
  };
  if (!res.ok || !body.ok) throw new Error(body.error || `删除失败 HTTP ${res.status}`);
  return body.deleted ?? { links: 0, logs: 0 };
}

export function message(e: unknown): string {
  if (e && typeof e === 'object') {
    const any = e as { message?: string; response?: { message?: string } };
    return any.response?.message || any.message || '未知错误';
  }
  return String(e);
}

import { useState } from 'react';
import { TaskSheet } from '../components/TaskSheet';
import { message, useShortLink, useUpdateTask } from '../lib/data';
import { Link, navigate } from '../lib/router';
import { STATUS_LABEL, type Status } from '../lib/types';

export function Landing({ code }: { code: string }) {
  const { loading, task, link, error } = useShortLink(code);
  const update = useUpdateTask();
  const [pending, setPending] = useState<Status | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function act(status: Status) {
    if (!task) return;
    setPending(status);
    setFlash(null);
    try {
      await update(task.id, { status });
      setFlash(`已标记为「${STATUS_LABEL[status]}」`);
    } catch (e) {
      setFlash(`没改成：${message(e)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mat px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-3 flex items-center justify-between px-1 font-mono text-[10px] tracking-[0.2em] text-paper/40">
          <span>任务卡片 · 扫码</span>
          <span className="text-paper/60">{code}</span>
        </div>

        {loading && <div className="h-[380px] animate-pulse bg-paper/10" />}

        {!loading && error && (
          <div className="bg-paper px-6 py-10 text-ink trim">
            <p className="text-[15px] font-semibold">这张卡没对上号</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{error}</p>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-soft">
              可能原因：短码印错、数据库里还没导入这张卡、或者 PocketBase 没启动。
            </p>
            <Link
              to="/"
              className="mt-6 inline-block border border-ink/25 px-3 py-2 text-[12px] hover:bg-ink/5"
            >
              回看板
            </Link>
          </div>
        )}

        {task && <TaskSheet task={task} code={code} scans={link?.scans} />}

        {task && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => act('done')}
              className="w-full bg-seal px-4 py-4 text-[15px] font-semibold tracking-[0.1em] text-paper transition-colors hover:bg-seal/90 disabled:opacity-50"
            >
              {pending === 'done' ? '提交中…' : '✓ 做完了'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => act('doing')}
                className="border border-paper/25 px-4 py-3 text-[13px] text-paper/85 transition-colors hover:border-paper/50 disabled:opacity-50"
              >
                正在进行
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => act('paused')}
                className="border border-paper/25 px-4 py-3 text-[13px] text-paper/85 transition-colors hover:border-paper/50 disabled:opacity-50"
              >
                先搁置
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-1 pt-1 text-[11px] text-paper/40">
              <span>{flash ?? '点一下，网页和纸卡就同步了'}</span>
              <Link
                to={`/tasks/${task.id}`}
                className="shrink-0 underline decoration-paper/25 underline-offset-4"
              >
                详情
              </Link>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] tracking-[0.18em] text-paper/25">
          <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => navigate('/')}
          >
            任务卡片 · 一叠纸 + 一个网页
          </button>
        </p>
      </div>
    </div>
  );
}

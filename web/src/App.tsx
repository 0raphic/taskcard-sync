import { Shell } from './components/Shell';
import { usePathname } from './lib/router';
import { Board } from './pages/Board';
import { Capture } from './pages/Capture';
import { Detail } from './pages/Detail';
import { Landing } from './pages/Landing';
import { TaskList } from './pages/TaskList';

export function App() {
  const path = usePathname();

  // 扫码落地页不套外壳：手机上要像一张卡，而不是一个后台
  const landing = /^\/t\/([^/]+)\/?$/.exec(path);
  if (landing) return <Landing code={decodeURIComponent(landing[1])} />;

  const detail = /^\/tasks\/([^/]+)\/?$/.exec(path);
  let page = <Board />;
  if (detail) page = <Detail id={decodeURIComponent(detail[1])} />;
  else if (path.startsWith('/tasks')) page = <TaskList />;
  else if (path.startsWith('/capture')) page = <Capture />;
  else if (path !== '/' && path !== '') page = <NotFound path={path} />;

  return <Shell>{page}</Shell>;
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="flex flex-col gap-2 py-16">
      <p className="font-mono text-[12px] text-paper/40">{path}</p>
      <h1 className="text-[22px] font-semibold">没有这个页面</h1>
      <p className="text-[13px] text-paper/50">
        回 <a href="/" className="underline underline-offset-4">看板</a> 吧。
      </p>
    </div>
  );
}

import { PasscodeGate } from './components/PasscodeGate';
import { Shell } from './components/Shell';
import { usePathname } from './lib/router';
import { Board } from './pages/Board';
import { Capture } from './pages/Capture';
import { Detail } from './pages/Detail';
import { Landing } from './pages/Landing';
import { Print } from './pages/Print';
import { Cards } from './pages/Cards';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';
import { TaskList } from './pages/TaskList';

export function App() {
  const path = usePathname();

  // 扫码落地页不套外壳：手机上要像一张卡，而不是一个后台
  const landing = /^\/t\/([^/]+)\/?$/.exec(path);
  if (landing) {
    return (
      <>
        <Landing code={decodeURIComponent(landing[1])} />
        <PasscodeGate />
      </>
    );
  }

  const detail = /^\/tasks\/([^/]+)\/?$/.exec(path);
  let page = <Board />;
  if (detail) page = <Detail id={decodeURIComponent(detail[1])} />;
  else if (path.startsWith('/tasks')) page = <TaskList />;
  else if (path.startsWith('/capture')) page = <Capture />;
  else if (path.startsWith('/print')) page = <Print />;
  else if (path.startsWith('/cards')) page = <Cards />;
  else if (path.startsWith('/settings')) page = <Settings />;
  else if (path.startsWith('/stats')) page = <Stats />;
  else if (path !== '/' && path !== '') page = <NotFound path={path} />;

  return (
    <>
      <Shell>{page}</Shell>
      <PasscodeGate />
    </>
  );
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="flex flex-col gap-2 py-16">
      <p className="font-mono text-[12px] text-oncanvas/40">{path}</p>
      <h1 className="text-[22px] font-semibold">没有这个页面</h1>
      <p className="text-[13px] text-oncanvas/50">
        回 <a href="/" className="underline underline-offset-4">看板</a> 吧。
      </p>
    </div>
  );
}

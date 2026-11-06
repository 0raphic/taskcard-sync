@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   任务卡片 · 一键启动
echo   第一次跑需要 node + pnpm，之后双击即可。
echo.
node scripts/start-demo.mjs
echo.
echo 进程已退出，按任意键关闭窗口。
pause >nul

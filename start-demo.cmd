@echo off
cd /d "%~dp0"
title Task Card - Demo

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js not found. Install LTS from https://nodejs.org/ first.
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   pnpm not found. Run: npm install -g pnpm
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   First run: installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo   Install failed. See the error above.
    pause
    exit /b 1
  )
)

echo.
echo   Starting Task Card demo. Keep this window open.
echo.
node scripts/start-demo.mjs
echo.
echo   Stopped. Press any key to close.
pause >nul

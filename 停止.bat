@echo off
chcp 65001 >nul
echo 正在停止 racehud 前后端服务...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4001" ^| findstr "LISTENING"') do (
    echo   - 停止后端 PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174" ^| findstr "LISTENING"') do (
    echo   - 停止前端 PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo 完成。
timeout /t 2 /nobreak >nul

@echo off
chcp 65001 >nul
title racehud 启动器

echo ================================
echo   racehud - 一键启动
echo ================================
echo.

cd /d "%~dp0"

echo [1/2] 启动后端 (端口 4001)...
start "racehud 后端" "%~dp003-后端服务\_run.bat"

timeout /t 2 /nobreak >nul

echo [2/2] 启动前端 (端口 5174)...
start "racehud 前端" "%~dp004-前端应用\_run.bat"

timeout /t 6 /nobreak >nul

echo.
echo ================================
echo   启动完成，正在打开浏览器...
echo ================================
start http://localhost:5174

echo.
echo 关闭此窗口不会停止服务。
echo 停止服务请运行 停止.bat 或关闭弹出的两个窗口。
timeout /t 5 /nobreak >nul

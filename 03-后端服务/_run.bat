@echo off
chcp 65001 >nul
title racehud 后端
cd /d "%~dp0"
if not exist node_modules (
    echo 首次运行，安装依赖...
    call npm install
)
node index.js
pause

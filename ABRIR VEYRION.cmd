@echo off
cd /d "%~dp0"
node tools\launch.mjs
if errorlevel 1 pause

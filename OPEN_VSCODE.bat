@echo off
setlocal
cd /d "%~dp0"
where code >nul 2>nul
if errorlevel 1 (
  echo O comando 'code' nao foi encontrado.
  echo Abra o VS Code e use File ^> Open Folder nesta pasta.
  pause
  exit /b 1
)
code .

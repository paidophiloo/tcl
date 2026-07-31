@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao foi encontrado.
  echo Instale a versao LTS do Node.js, feche este terminal e tente novamente.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias do projeto...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando Touchline em modo desenvolvimento...
call npm run dev

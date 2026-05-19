@echo off
cd /d "%~dp0"

echo ========================================
echo   Control de Stock - Iniciando...
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no esta en el PATH.
    echo Instala Node o ejecuta este .bat desde una ventana donde funcione "node".
    echo.
    pause
    exit /b 1
)

if not exist "prisma\dev.db" (
    echo Primera vez: creando base de datos...
    call npx prisma generate
    call npx prisma db push
    call npm run db:seed 2>nul
    echo.
    echo Base de datos lista.
    echo.
)

echo Abre http://localhost:3000 en tu navegador
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo Error al iniciar el servidor. Revisa el mensaje de arriba.
    echo.
)
pause

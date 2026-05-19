@echo off
:: Proxy inverso con Caddy: puerto 80 -> app en 3000
:: Debe ejecutarse como Administrador (puerto 80).
:: Primero inicia la app (iniciar.bat) en otra ventana.

cd /d "%~dp0"

net session >nul 2>nul
if errorlevel 1 (
    echo Caddy necesita permisos de administrador para el puerto 80.
    echo Clic derecho en este archivo -^> "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

where caddy >nul 2>nul
if errorlevel 1 (
    echo Caddy no esta instalado o no esta en el PATH.
    echo.
    echo 1. Descarga: https://caddyserver.com/download
    echo    Windows: caddy_2.x_windows_amd64.zip -^> descomprimir y poner caddy.exe en el PATH o en esta carpeta.
    echo 2. O con Chocolatey: choco install caddy
    echo 3. Vuelve a ejecutar este archivo como administrador.
    echo.
    pause
    exit /b 1
)

echo Asegurate de que la app este corriendo en otra ventana ^(iniciar.bat^).
echo.
echo Iniciando Caddy: puerto 80 -^> http://localhost:3000
echo fe-netstock.uno y 192.168.1.13 apuntaran a la app.
echo.
caddy run --config Caddyfile
pause

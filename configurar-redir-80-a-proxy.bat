@echo off
:: Una sola vez como administrador: redirige puerto 80 -> 8080 (donde escucha el proxy).
:: Asi el proxy puede correr sin admin (en 8080) y todo lo que llegue al 80 va al proxy.

net session >nul 2>&1
if errorlevel 1 (
    echo Ejecuta este archivo como administrador: clic derecho -^> "Ejecutar como administrador"
    pause
    exit /b 1
)

echo Configurando: puerto 80 -^> 8080 ^(proxy^)
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=8080 connectaddress=127.0.0.1 2>nul
if errorlevel 1 (
    echo La regla puede ya existir. Para ver: netsh interface portproxy show all
) else (
    echo Listo. Ahora el trafico al puerto 80 se enviara al proxy en 8080.
)
echo.
pause

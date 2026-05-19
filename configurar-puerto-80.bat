@echo off
:: Ejecuta este archivo UNA VEZ como Administrador (clic derecho -> Ejecutar como administrador)
:: Redirige el puerto 80 al 3000 para que puedas abrir http://localhost sin ejecutar la app como admin.

net session >nul 2>&1
if errorlevel 1 (
    echo Debes ejecutar este archivo como Administrador.
    echo Clic derecho en configurar-puerto-80.bat -^> "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo Configurando redireccion: puerto 80 -^> 3000
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1
if errorlevel 1 (
    echo.
    echo Puede que la regla ya exista. Para ver reglas: netsh interface portproxy show all
    echo Para borrarla: netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0
    echo.
) else (
    echo Listo. Ahora http://localhost redirigira al servidor en el puerto 3000.
    echo.
)
pause

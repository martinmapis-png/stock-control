@echo off
:: Proxy 8080 -> 3000. No requiere admin.
:: Para que el puerto 80 llegue al proxy: ejecuta UNA VEZ como admin "configurar-redir-80-a-proxy.bat"

cd /d "%~dp0"

echo Proxy: puerto 8080 -^> 3000
echo Si aun no lo hiciste, ejecuta UNA VEZ como admin: configurar-redir-80-a-proxy.bat
echo Asi el 80 se redirige al proxy y no hace falta tocar el router.
echo.
echo Asegurate de que iniciar.bat este corriendo en otra ventana.
echo.
node proxy-80-3000.js
pause

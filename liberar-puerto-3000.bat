@echo off
:: Libera el puerto 3000 matando el proceso que lo usa (ej. una instancia anterior del servidor)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Cerrando proceso %%a que usa el puerto 3000...
    taskkill /PID %%a /F 2>nul
    if not errorlevel 1 echo Puerto 3000 liberado.
    goto :done
)
echo No se encontro ningun proceso escuchando en el puerto 3000.
:done
echo.
pause

@echo off
title Pacifico BDS - Minecraft Bedrock con Persistencia SQLite
color 0B

echo =================================================================
echo    INICIADOR SEGURO DE SERVIDOR BDS - PACIFICO COMUNITARIO
echo    Con Demonio SQLite V3 (Cero corrupcion de mundos)
echo =================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js ^(version 22 o superior^) desde https://nodejs.org
    pause
    exit /b 1
)

set BDS_DIR=%~dp0
if exist "%BDS_DIR%bedrock_server.exe" (
    goto :RUN
)

if exist "%BDS_DIR%..\bedrock_server.exe" (
    set BDS_DIR=%BDS_DIR%..\
    goto :RUN
)

echo Introduce la ruta de la carpeta de tu servidor BDS (donde esta bedrock_server.exe):
set /p BDS_DIR="Ruta: "

:RUN
echo -> Directorio BDS configurado: %BDS_DIR%
echo -> Iniciando supervisor SQLite V3...
echo.

node "%~dp0bridge\sqlite-daemon.js" --bds-path "%BDS_DIR%" --auto-restart

if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] El servidor se ha detenido con codigo de error %ERRORLEVEL%.
    pause
)

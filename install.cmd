@echo off
setlocal
rem Run from the extracted repository. No administrator rights or Node.js required.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0tools\install.ps1" %*
set "install_exit=%errorlevel%"
if not "%install_exit%"=="0" echo Installation failed. Read the error above. Existing user files are not cleaned up.
if "%~1"=="" pause
exit /b %install_exit%

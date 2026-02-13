@echo off
echo Stopping backend server...
taskkill /F /IM node.exe

echo.
echo Running hard reset...
cd backend
node hard-reset.js

echo.
echo Starting backend server...
start npm start

echo.
echo Done! You can close this window.
pause

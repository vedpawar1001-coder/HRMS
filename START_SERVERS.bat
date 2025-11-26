@echo off
echo ========================================
echo    HRMS - Starting Servers Only
echo ========================================
echo.

REM Check if .env exists, create if not
if not exist "backend\.env" (
    echo Creating backend .env file...
    (
        echo PORT=5000
        echo MONGODB_URI=mongodb://localhost:27017/hrms
        echo JWT_SECRET=your_jwt_secret_key_change_in_production_12345
        echo JWT_EXPIRE=7d
        echo NODE_ENV=development
    ) > backend\.env
    echo .env file created!
    echo.
)

REM Start Backend Server
echo [1/2] Starting Backend Server (Port 5000)...
start "HRMS Backend" cmd /k "cd /d %~dp0backend && echo Backend Server && echo ========== && npm run dev"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo [2/2] Starting Frontend Server (Port 3000)...
start "HRMS Frontend" cmd /k "cd /d %~dp0frontend && echo Frontend Server && echo ========== && npm run dev"

echo.
echo ========================================
echo    Servers Starting...
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Two new windows opened with servers.
echo Wait 10-15 seconds, then open:
echo http://localhost:3000 in your browser
echo.
echo Press any key to open Chrome automatically...
pause >nul

REM Open Chrome
start chrome.exe http://localhost:3000


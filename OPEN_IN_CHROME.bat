@echo off
echo ========================================
echo    Starting HRMS and Opening Chrome
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

REM Start Backend Server in new window
echo Starting Backend Server...
start "HRMS Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Frontend Server in new window
echo Starting Frontend Server...
start "HRMS Frontend Server" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 8 /nobreak >nul

REM Open Chrome browser
echo Opening Chrome browser...
start chrome.exe http://localhost:3000

echo.
echo ========================================
echo    Done! Chrome should be opening...
echo ========================================
echo.
echo Two windows opened:
echo - Backend Server (check for errors)
echo - Frontend Server (check for errors)
echo.
echo If Chrome didn't open, manually go to:
echo http://localhost:3000
echo.
pause


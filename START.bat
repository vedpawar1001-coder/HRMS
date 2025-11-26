@echo off
echo ========================================
echo    HRMS Application Startup Script
echo ========================================
echo.

echo Step 1: Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js is installed.
echo.

echo Step 2: Checking MongoDB connection...
echo Please ensure MongoDB is running locally or using MongoDB Atlas
echo.

echo Step 3: Checking backend dependencies...
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo Backend dependencies already installed.
)
echo.

echo Step 4: Checking frontend dependencies...
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo Frontend dependencies already installed.
)
echo.

echo Step 5: Starting backend server...
start "HRMS Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
echo.

echo Step 6: Starting frontend server...
start "HRMS Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul
echo.

echo ========================================
echo    Application Starting...
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Two new windows have been opened:
echo - One for Backend server
echo - One for Frontend server
echo.
echo Please wait for both servers to start...
echo Then open your browser and go to: http://localhost:3000
echo.
pause


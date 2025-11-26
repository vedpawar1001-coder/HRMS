@echo off
echo Creating backend .env file...

if not exist "backend\.env" (
    (
        echo PORT=5000
        echo MONGODB_URI=mongodb://localhost:27017/hrms
        echo JWT_SECRET=your_jwt_secret_key_change_in_production_12345
        echo JWT_EXPIRE=7d
        echo NODE_ENV=development
    ) > backend\.env
    echo ✓ Backend .env file created successfully!
) else (
    echo Backend .env file already exists.
)

echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo 1. Make sure MongoDB is running
echo 2. If using MongoDB Atlas, update backend\.env with your connection string
echo 3. Run START.bat to start the application
echo.
pause


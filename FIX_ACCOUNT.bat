@echo off
echo ========================================
echo    Fix User Account - Delete or Reset
echo ========================================
echo.

if "%1"=="" (
    echo Usage: FIX_ACCOUNT.bat delete vedpawar292001@gmail.com
    echo    OR: FIX_ACCOUNT.bat reset vedpawar292001@gmail.com 123456789
    echo.
    echo Options:
    echo   delete - Delete the user account
    echo   reset  - Reset the password
    echo.
    pause
    exit /b
)

if "%1"=="delete" (
    echo Deleting user account: %2
    cd backend
    node fix-user.js %2
    cd ..
) else if "%1"=="reset" (
    echo Resetting password for: %2
    cd backend
    node fix-user.js %2 %3
    cd ..
) else (
    echo Invalid option: %1
    echo Use "delete" or "reset"
)

echo.
pause


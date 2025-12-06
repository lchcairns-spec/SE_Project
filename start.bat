@echo off
echo Starting Online Voting System...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env file with your configuration before starting!
    pause
    exit /b
)

echo Starting server...
npm start


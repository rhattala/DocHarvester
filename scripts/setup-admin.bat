@echo off

REM DocHarvester Admin Setup Script for Windows

echo 🚀 DocHarvester Admin Setup
echo ==========================

REM Check if Docker Compose is running
docker-compose ps | findstr "docharvester-backend-1.*Up" >nul
if %errorlevel% neq 0 (
    echo ❌ DocHarvester backend is not running.
    echo Please start the application first with: docker-compose up -d
    exit /b 1
)

echo ✅ Backend is running. Creating admin user...

REM Run the admin creation script
docker-compose exec backend python backend/scripts/docker_create_admin.py

echo.
echo 🎯 Next Steps:
echo 1. Open http://localhost:3000 in your browser
echo 2. Login with the admin credentials shown above
echo 3. Change the default password in your profile settings
echo 4. Start creating projects and uploading documents!
echo.
echo 📚 API Documentation: http://localhost:8000/docs

pause 
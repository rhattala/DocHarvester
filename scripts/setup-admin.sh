#!/bin/bash

# DocHarvester Admin Setup Script

echo "🚀 DocHarvester Admin Setup"
echo "=========================="

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "docharvester-backend-1.*Up"; then
    echo "❌ DocHarvester backend is not running."
    echo "Please start the application first with: docker-compose up -d"
    exit 1
fi

echo "✅ Backend is running. Creating admin user..."

# Run the admin creation script
docker-compose exec backend python backend/scripts/docker_create_admin.py

echo ""
echo "🎯 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login with the admin credentials shown above"
echo "3. Change the default password in your profile settings"
echo "4. Start creating projects and uploading documents!"
echo ""
echo "📚 API Documentation: http://localhost:8000/docs" 
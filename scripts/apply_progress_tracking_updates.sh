#!/bin/bash

# DocHarvester Progress Tracking & Wiki Generation Setup Script
# This script helps apply all the progress tracking and wiki generation improvements

set -e  # Exit on any error

echo "🚀 Setting up DocHarvester Progress Tracking & Wiki Generation Improvements"
echo "=========================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the DocHarvester root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-flight checks...${NC}"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from env.example...${NC}"
    cp env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Backup current .env file
echo -e "${BLUE}💾 Creating backup of current .env file...${NC}"
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Backup created${NC}"

# Update environment variables for optimal progress tracking
echo -e "${BLUE}🔧 Updating environment configuration...${NC}"

# Add progress tracking specific settings if they don't exist
grep -q "WIKI_GENERATION_TIMEOUT" .env || echo "WIKI_GENERATION_TIMEOUT=120" >> .env
grep -q "ENTITY_EXTRACTION_TIMEOUT" .env || echo "ENTITY_EXTRACTION_TIMEOUT=90" >> .env
grep -q "CACHE_MAX_SIZE" .env || echo "CACHE_MAX_SIZE=100" >> .env

# Ensure OpenAI is prioritized for wiki generation
if grep -q "CURRENT_LLM_PROVIDER=LOCAL" .env; then
    echo -e "${YELLOW}⚠️  Found LOCAL LLM provider setting${NC}"
    read -p "Do you want to switch to OpenAI for better wiki generation quality? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sed -i.bak 's/CURRENT_LLM_PROVIDER=LOCAL/CURRENT_LLM_PROVIDER=OPENAI/' .env
        echo -e "${GREEN}✅ Switched to OpenAI provider${NC}"
        echo -e "${YELLOW}⚠️  Make sure to set your OPENAI_API_KEY in .env${NC}"
    fi
fi

echo -e "${GREEN}✅ Environment configuration updated${NC}"

# Database setup
echo -e "${BLUE}🗄️  Setting up database...${NC}"

# Check if services are running
if ! docker-compose ps | grep -q "postgres.*Up"; then
    echo -e "${YELLOW}⚠️  Starting database services...${NC}"
    docker-compose up -d postgres redis
    echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
    sleep 10
fi

# Apply database migration
echo -e "${BLUE}🔧 Applying database schema updates...${NC}"
if [ -f "scripts/setup_progress_tracking.sql" ]; then
    echo -e "${BLUE}📥 Applying progress tracking schema...${NC}"
    docker-compose exec -T postgres psql -U postgres -d docharvester < scripts/setup_progress_tracking.sql
    echo -e "${GREEN}✅ Database schema updated${NC}"
else
    echo -e "${YELLOW}⚠️  Manual database setup required. Please run:${NC}"
    echo "docker-compose exec postgres psql -U postgres -d docharvester"
    echo "Then copy and paste the SQL from scripts/setup_progress_tracking.sql"
fi

# Restart services to pick up new code
echo -e "${BLUE}🔄 Restarting services to apply changes...${NC}"
docker-compose down
docker-compose up -d

echo -e "${BLUE}⏳ Waiting for services to start up...${NC}"
sleep 15

# Health check
echo -e "${BLUE}🏥 Performing health checks...${NC}"

# Check backend API
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API is healthy${NC}"
else
    echo -e "${RED}❌ Backend API health check failed${NC}"
    echo -e "${YELLOW}💡 Check logs with: docker-compose logs backend${NC}"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    echo -e "${YELLOW}💡 Check logs with: docker-compose logs frontend${NC}"
fi

# Check progress API endpoints
if curl -s http://localhost:8000/api/v1/progress/projects/1/tasks > /dev/null; then
    echo -e "${GREEN}✅ Progress tracking API is working${NC}"
else
    echo -e "${YELLOW}⚠️  Progress tracking API not yet accessible (may need authentication)${NC}"
fi

echo
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=========================================="
echo
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. 🌐 Access the application at: http://localhost:3000"
echo "2. 📚 Access API docs at: http://localhost:8000/docs"
echo "3. 🧠 Check Neo4j browser at: http://localhost:7474"
echo
echo -e "${BLUE}🔧 Configuration:${NC}"
echo "• Progress tracking is now enabled"
echo "• Wiki generation will show real-time progress"
echo "• OpenAI integration prioritized for quality"
echo "• Knowledge graph efficiently integrated"
echo
echo -e "${BLUE}📖 Features Available:${NC}"
echo "• Real-time progress indicators for long operations"
echo "• ETA calculations and step-by-step progress"
echo "• Enhanced wiki generation with OpenAI"
echo "• Efficient knowledge graph utilization"
echo "• Operation cancellation support"
echo
echo -e "${BLUE}🧪 Testing:${NC}"
echo "1. Create/select a project"
echo "2. Generate a wiki and watch real-time progress"
echo "3. Try entity extraction and knowledge graph operations"
echo "4. Monitor progress in the UI"
echo
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "• Set OPENAI_API_KEY in .env for best wiki quality"
echo "• Progress tracking requires PostgreSQL and Redis"
echo "• Check docker-compose logs if any issues occur"
echo
echo -e "${GREEN}✨ DocHarvester is ready with enhanced progress tracking!${NC}"
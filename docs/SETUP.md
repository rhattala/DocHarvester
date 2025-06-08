# 🚀 DocHarvester Setup Guide

## Prerequisites

### Required Software
- **Docker Desktop** (v20.10+) - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/downloads)

### System Requirements
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 15GB free space minimum
- **Ports**: 3000, 7474, 7687, 8000, 11434 available

## Quick Setup

### 1. Clone & Configure
```bash
git clone <repository-url>
cd DocHarvester
cp env.example .env
```

### 2. Update Environment Variables
Edit `.env` and set your API keys (if using OpenAI):
```env
# Required for OpenAI features (optional)
OPENAI_API_KEY=your_actual_openai_api_key_here
OPENAI_ORGANIZATION_ID=your_org_id_here  # Optional

# Local LLM (always enabled)
USE_LOCAL_LLM=true
LOCAL_LLM_MODEL=gemma:2b

# Neo4j Database
NEO4J_PASSWORD=your_secure_neo4j_password_here

# Application Security
SECRET_KEY=your_secure_secret_key_here
```

### 3. Start Services
```bash
docker-compose up -d
```

### 4. Wait for Services (2-3 minutes)
```bash
# Monitor startup
docker-compose logs -f
```

### 5. Access Applications
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474 (neo4j/your_secure_password)

## Service Health Check

```bash
# Check all services
docker-compose ps

# Expected output: All services "healthy"
```

## API Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Get access token (username: admin, password: admin)
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin"
```

## Troubleshooting

### Services Won't Start
```bash
# Clean restart
docker-compose down -v
docker-compose up -d --build
```

### Port Conflicts
```bash
# Check ports
netstat -an | grep LISTEN | grep -E "(3000|7474|7687|8000|11434)"

# Kill processes if needed
sudo lsof -ti:8000 | xargs kill -9
```

### Memory Issues
```bash
# Check Docker resources
docker stats

# Increase Docker Desktop memory to 8GB+
```

### Neo4j Connection Issues
```bash
# Check Neo4j logs
docker-compose logs neo4j

# Reset Neo4j data
docker-compose down
docker volume rm docharvester_neo4j_data
docker-compose up -d
```

## Security Notes

⚠️ **Important**: 
- Change default passwords in production
- Use secure random keys for SECRET_KEY
- Keep API keys private and never commit them to git
- Use strong passwords for Neo4j in production environments

## Production Deployment

For production deployment:
1. Update all default passwords
2. Use HTTPS with proper certificates
3. Configure firewall rules
4. Set up monitoring and backups
5. Use environment-specific configuration files 
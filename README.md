# WORK IN PROGRESS 🚀 DocHarvester

AI-powered document processing and knowledge extraction platform with integrated knowledge graphs and local LLM support.

## ✨ Key Features

- **📄 Multi-format Document Processing**: PDF, DOCX, TXT, Markdown, and more
- **🔍 Smart Content Classification**: LOGIC, SOP, GTM, CL lens-based categorization
- **🧠 Knowledge Graph Integration**: Entity extraction and relationship mapping with Neo4j
- **🤖 Hybrid AI Support**: Local LLMs (Ollama) + OpenAI integration
- **📚 Automated Wiki Generation**: AI-generated documentation from your content
- **🔗 Multiple Data Sources**: Local folders, Git repos, SharePoint, Confluence
- **⚡ Real-time Processing**: Background tasks with Celery
- **🎯 Intelligent Search**: Vector-based semantic search with metadata filtering

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │  Database   │
│  (React)    │◄──►│  (FastAPI)  │◄──►│ (Postgres)  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
            ┌─────────────┐ ┌─────────────┐
            │    Neo4j    │ │   Ollama    │
            │(Knowledge)  │ │   (LLM)     │
            └─────────────┘ └─────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (8GB+ RAM recommended)
- Git

### Setup
```bash
# Clone repository
git clone <repository-url>
cd DocHarvester

# Configure environment
cp env.example .env
# Edit .env with your settings (see Configuration section)

# Start all services
docker-compose up -d

# Monitor startup (takes 2-3 minutes)
docker-compose logs -f
```

### Access Points
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474 (neo4j/your_secure_password)

## ⚙️ Configuration

### Required Environment Variables

```env
# Security (IMPORTANT: Change these!)
SECRET_KEY=your_secure_secret_key_here
NEO4J_PASSWORD=your_secure_neo4j_password_here

# OpenAI (Optional - for advanced features)
OPENAI_API_KEY=your_actual_openai_api_key_here
OPENAI_ORGANIZATION_ID=your_organization_id_here

# Local LLM (Always available)
USE_LOCAL_LLM=true
LOCAL_LLM_MODEL=gemma:2b
```

### Model Recommendations

**Local Models (Free, Private):**
- `gemma:2b` - 1.6GB, fits in 8GB+ RAM, good for development
- `gemma:7b` - 4GB, needs 16GB+ RAM, better quality
- `llama3:8b` - 5GB, needs 16GB+ RAM, high quality

**OpenAI Models (Paid, Large Context):**
- `gpt-4o` - 128k context, best overall performance
- `gpt-4o-mini` - 128k context, cost-effective
- `gpt-4-turbo` - 128k context, high performance

## 📋 Usage

### 1. Authentication
```bash
# Get access token
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin"
```

### 2. Create Project
```bash
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "description": "Test project"}'
```

### 3. Upload Documents
```bash
curl -X POST http://localhost:8000/api/v1/projects/1/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"
```

### 4. Generate Wiki
```bash
curl -X POST http://localhost:8000/api/v1/projects/1/wiki/generate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## � Development

### Local Development Setup
```bash
# Backend development
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Frontend development
cd frontend
npm install
npm start
```

### Testing
```bash
# Backend tests
cd backend && python -m pytest

# Frontend tests
cd frontend && npm test

# Integration tests
python test_optimized_system.py
```

## �️ Architecture Details

### Core Components
- **FastAPI Backend**: REST API with async support
- **React Frontend**: Modern UI with Material-UI
- **PostgreSQL**: Primary database with pgvector for embeddings
- **Neo4j**: Knowledge graph storage and querying
- **Redis**: Caching and task queue management
- **Celery**: Background task processing
- **Ollama**: Local LLM inference server

### Data Flow
1. **Document Upload** → Text extraction → Chunking
2. **Entity Extraction** → Knowledge graph construction
3. **Embedding Generation** → Vector storage
4. **Wiki Generation** → AI-powered documentation

## 🔒 Security

**Important Security Notes:**
- Change all default passwords in production
- Use strong, random secret keys
- Keep API keys private and never commit to git
- Use HTTPS in production
- Regularly update dependencies

## � API Documentation

Full API documentation is available at http://localhost:8000/docs when running.

Key endpoints:
- `POST /api/v1/auth/token` - Authentication
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `POST /api/v1/projects/{id}/documents/upload` - Upload documents
- `POST /api/v1/projects/{id}/wiki/generate` - Generate wiki
- `GET /api/v1/projects/{id}/knowledge-graph` - Get knowledge graph

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: See `/docs` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Security**: Report security issues privately to maintainers

---

**Built with ❤️ for better document intelligence** 

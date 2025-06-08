# 📚 DocHarvester API Documentation

## Authentication

Get an access token:
```bash
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin"
```

Save the token for subsequent requests:
```bash
export TOKEN="your_access_token_here"
```

## Core Endpoints

### Projects
```bash
# List projects
GET /api/v1/projects

# Create project
POST /api/v1/projects
{
  "name": "My Project",
  "description": "Project description",
  "tags": ["tag1", "tag2"]
}

# Get project
GET /api/v1/projects/{id}
```

### Documents
```bash
# Upload document
POST /api/v1/projects/{id}/documents/upload
-F "file=@document.pdf"

# List documents
GET /api/v1/projects/{id}/documents

# Process documents
POST /api/v1/projects/{id}/ingest
```

### Knowledge Graph
```bash
# Extract entities
POST /api/v1/knowledge-graph/projects/{id}/extract-entities

# Get graph statistics
GET /api/v1/knowledge-graph/projects/{id}/stats

# Query entities
GET /api/v1/knowledge-graph/projects/{id}/entities
```

### Wiki Generation
```bash
# Generate wiki
POST /api/v1/wiki/generate/{project_id}

# Get wiki structure
GET /api/v1/wiki/{project_id}/structure

# Get wiki page
GET /api/v1/wiki/{project_id}/pages/{page_id}
```

### Admin
```bash
# Get LLM settings
GET /api/v1/admin/llm/settings

# Switch LLM provider
POST /api/v1/admin/llm/switch_provider
{
  "provider": "OPENAI"  // or "LOCAL"
}

# Get system health
GET /api/v1/health
```

## Example Workflow

1. **Create project**:
```bash
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Testing DocHarvester"}'
```

2. **Upload document**:
```bash
curl -X POST http://localhost:8000/api/v1/projects/1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@example.pdf"
```

3. **Process documents**:
```bash
curl -X POST http://localhost:8000/api/v1/projects/1/ingest \
  -H "Authorization: Bearer $TOKEN"
```

4. **Generate wiki**:
```bash
curl -X POST http://localhost:8000/api/v1/wiki/generate/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Interactive Documentation

Visit http://localhost:8000/docs for the complete interactive API documentation with Swagger UI. 
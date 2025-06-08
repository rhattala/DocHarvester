FROM python:3.11-slim

WORKDIR /app

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a simple placeholder service for now
# In production, you would integrate the actual Graphiti
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    httpx \
    pydantic

# Create a simple API placeholder
RUN echo 'from fastapi import FastAPI\n\
import uvicorn\n\
\n\
app = FastAPI(title="Graphiti Placeholder")\n\
\n\
@app.get("/")\n\
async def root():\n\
    return {"message": "Graphiti placeholder service", "status": "ready"}\n\
\n\
@app.get("/health")\n\
async def health():\n\
    return {"status": "healthy"}\n\
\n\
if __name__ == "__main__":\n\
    uvicorn.run(app, host="0.0.0.0", port=8000)\n\
' > main.py

# Expose port
EXPOSE 8000

# Start the placeholder service
CMD ["python", "main.py"] 
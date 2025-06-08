#!/bin/bash

echo "🔄 Enabling Local LLM Mode for DocHarvester"
echo "=========================================="

# Set environment variables for local LLM
export USE_LOCAL_LLM=true
export LOCAL_LLM_MODEL=llama3:8b
export OLLAMA_BASE_URL=http://localhost:11434

echo "✅ Environment variables set:"
echo "   USE_LOCAL_LLM=true"
echo "   LOCAL_LLM_MODEL=llama3:8b"
echo "   OLLAMA_BASE_URL=http://localhost:11434"

echo ""
echo "🔄 Restarting backend services..."
docker-compose restart backend celery-worker

echo ""
echo "🧪 Testing local LLM connection..."
response=$(curl -s -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -d '{"model": "llama3:8b", "prompt": "Say \"Ready\" if you can understand this.", "stream": false}')

if echo "$response" | grep -q "Ready"; then
    echo "✅ Local LLM is responding correctly!"
else
    echo "⚠️  Local LLM test response:"
    echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('response', 'No response'))"
fi

echo ""
echo "🎯 Local LLM mode enabled! Try generating a wiki now."
echo "   The system will use Ollama instead of OpenAI."
echo ""
echo "💡 To revert to OpenAI:"
echo "   export USE_LOCAL_LLM=false"
echo "   docker-compose restart backend celery-worker" 
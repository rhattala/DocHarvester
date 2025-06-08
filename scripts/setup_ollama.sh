#!/bin/bash

echo "🚀 Setting up Ollama Local LLM for DocHarvester"
echo "================================================"

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to start..."
until curl -f http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "   Waiting for Ollama API..."
    sleep 5
done

echo "✅ Ollama is ready!"

# Check if Docker service is running
if ! docker-compose ps ollama | grep -q "Up"; then
    echo "❌ Ollama container is not running. Please start with 'docker-compose up -d'"
    exit 1
fi

echo ""
echo "📋 Current Ollama Status:"
echo "========================"
docker-compose logs ollama --tail 5

echo ""
echo "🔍 Checking existing models..."
echo "============================="
docker exec docharvester-ollama ollama list

echo ""
echo "📥 Pulling Optimized Models"
echo "============================"

# Pull the optimized gemma:2b model
echo "🔽 Pulling gemma:2b (1.6GB) - Memory-optimized model for all tasks..."
if docker exec docharvester-ollama ollama pull gemma:2b; then
    echo "✅ gemma:2b downloaded successfully"
else
    echo "❌ Failed to download gemma:2b"
    exit 1
fi

echo ""
echo "📊 Final Model Status:"
echo "====================="
docker exec docharvester-ollama ollama list

echo ""
echo "🧪 Testing Models"
echo "================="

# Test gemma:2b
echo "Testing gemma:2b..."
test_result=$(docker exec docharvester-ollama ollama run gemma:2b "Say 'OK' if you're working" --format json 2>/dev/null | grep -o '"response":"[^"]*"' | cut -d'"' -f4)

if [[ "$test_result" == *"OK"* ]] || [[ "$test_result" == *"ok"* ]]; then
    echo "✅ gemma:2b is working correctly"
else
    echo "⚠️ gemma:2b test was inconclusive, but model is installed"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo "Local LLM is ready for DocHarvester"
echo ""
echo "📝 Next Steps:"
echo "1. Verify your .env file has: USE_LOCAL_LLM=true"
echo "2. Ensure your .env file has: LOCAL_LLM_MODEL=gemma:2b"
echo "3. Restart backend services: docker-compose restart backend celery-worker"
echo ""
echo "🔧 Model Information:"
echo "   - gemma:2b: Memory-efficient, fits in 8GB+ RAM systems"
echo "   - Best for: Entity extraction, wiki generation, all tasks"
echo ""
echo "✅ Ready to process documents with local AI!" 
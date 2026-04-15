#!/bin/bash
# Quick start script for local development (without Docker)

set -e

echo "=== CRM System — Local Dev Start ==="

# Backend
echo ""
echo ">>> Starting backend..."
cd backend
pip install -r requirements.txt -q

# Run migrations
echo ">>> Running migrations..."
alembic upgrade head

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo ""
echo ">>> Starting frontend..."
cd frontend
npm install -q
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "==================================="
echo "Backend:  http://localhost:8000"
echo "Docs:     http://localhost:8000/api/docs"
echo "Frontend: http://localhost:5173"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait

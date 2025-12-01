#!/bin/bash

echo "🔄 ShiftPlanner Graceful Restart Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill processes on a port
kill_port() {
    local port=$1
    local name=$2
    echo -e "${YELLOW}Stopping $name on port $port...${NC}"
    lsof -ti:$port | xargs kill -15 2>/dev/null || true
    sleep 2
    # Force kill if still running
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ $name stopped${NC}"
}

# Stop backend (port 4000)
kill_port 4000 "Backend"

# Stop frontend (port 3000)
kill_port 3000 "Frontend"

echo ""
echo "🚀 Starting services..."
echo ""

# Start backend in background
cd backend
echo -e "${YELLOW}Starting Backend...${NC}"
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

# Wait a bit for backend to initialize
sleep 3

# Start frontend in background
cd frontend
echo -e "${YELLOW}Starting Frontend...${NC}"
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

echo ""
echo "========================================"
echo -e "${GREEN}✅ ShiftPlanner restarted successfully!${NC}"
echo ""
echo "Backend:  http://localhost:4000 (PID: $BACKEND_PID)"
echo "Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
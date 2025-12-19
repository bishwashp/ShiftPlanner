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
    
    # Find PID listening on port
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        # Try to find parent process (e.g., npm or ts-node-dev wrapper)
        local ppid=$(ps -o ppid= -p $pid 2>/dev/null | xargs)
        
        if [ ! -z "$ppid" ] && [ "$ppid" -ne "1" ]; then
            echo "  Found parent process $ppid for listener $pid. Killing parent..."
            kill -15 $ppid 2>/dev/null || true
        else
            echo "  Killing listener process $pid..."
            kill -15 $pid 2>/dev/null || true
        fi
        
        # Wait for port to be free
        local count=0
        while lsof -ti:$port >/dev/null 2>&1; do
            echo -n "."
            sleep 1
            count=$((count+1))
            if [ $count -ge 10 ]; then
                echo ""
                echo -e "${RED}  Force killing processes on port $port...${NC}"
                lsof -ti:$port | xargs kill -9 2>/dev/null || true
                break
            fi
        done
        echo ""
    fi
    
    echo -e "${GREEN}✓ $name stopped${NC}"
}

# Stop backend (port 4000)
kill_port 4000 "Backend"

# Stop frontend (port 3000)
kill_port 3000 "Frontend"

echo ""
echo "🚀 Starting services..."
echo ""

# Get the root directory of the project (one level up from scripts if run from scripts, or current dir if run from root)
PROJECT_ROOT=$(pwd)
if [[ "$PROJECT_ROOT" == */scripts ]]; then
    PROJECT_ROOT=${PROJECT_ROOT%/*}
fi

# Start backend in background
echo -e "${YELLOW}Starting Backend...${NC}"
(cd "$PROJECT_ROOT/backend" && npm run dev > "$PROJECT_ROOT/backend.log" 2>&1 & echo $! > "$PROJECT_ROOT/backend.pid")
BACKEND_PID=$(cat "$PROJECT_ROOT/backend.pid")
rm "$PROJECT_ROOT/backend.pid"
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

# Wait a bit for backend to initialize
sleep 3

# Start frontend in background
echo -e "${YELLOW}Starting Frontend...${NC}"
(cd "$PROJECT_ROOT/frontend" && npm start > "$PROJECT_ROOT/frontend.log" 2>&1 & echo $! > "$PROJECT_ROOT/frontend.pid")
FRONTEND_PID=$(cat "$PROJECT_ROOT/frontend.pid")
rm "$PROJECT_ROOT/frontend.pid"
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

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
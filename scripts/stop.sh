#!/bin/bash
echo "Stopping ShiftPlanner application..."

# Function to kill processes by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    echo "Stopping $service_name on port $port..."
    local pids=$(lsof -t -i:$port)
    if [ -n "$pids" ]; then
        echo "Found processes on port $port: $pids"
        # Kill all processes and their children
        for pid in $pids; do
            pkill -9 -P $pid 2>/dev/null
            kill -9 $pid 2>/dev/null
        done
        sleep 1
        # Double-check and kill any remaining processes
        local remaining_pids=$(lsof -t -i:$port)
        if [ -n "$remaining_pids" ]; then
            echo "Force killing remaining processes on port $port: $remaining_pids"
            kill -9 $remaining_pids 2>/dev/null
        fi
    fi
}

# Stop backend server
if [ -f backend.pid ]; then
    echo "Stopping backend server..."
    BACKEND_PID=$(cat backend.pid)
    
    if ps -p $BACKEND_PID > /dev/null; then
        echo "Killing backend process tree..."
        pkill -9 -P $BACKEND_PID 2>/dev/null
        kill -9 $BACKEND_PID 2>/dev/null
    fi
    
    rm backend.pid
fi

# Stop frontend server
if [ -f frontend.pid ]; then
    echo "Stopping frontend server..."
    FRONTEND_PID=$(cat frontend.pid)
    
    if ps -p $FRONTEND_PID > /dev/null; then
        echo "Killing frontend process tree..."
        pkill -9 -P $FRONTEND_PID 2>/dev/null
        kill -9 $FRONTEND_PID 2>/dev/null
    fi
    
    rm frontend.pid
fi

# Ensure all processes are killed by port
kill_by_port 4000 "backend"
kill_by_port 3000 "frontend"

# Final cleanup - kill any remaining ShiftPlanner processes
echo "Final cleanup..."
pkill -f "ShiftPlanner" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "ts-node-dev" 2>/dev/null

echo "ShiftPlanner application stopped." 
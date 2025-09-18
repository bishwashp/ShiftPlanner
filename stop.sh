#!/bin/bash
echo "Stopping ShiftPlanner application..."

# Stop backend server
if [ -f backend.pid ]; then
    echo "Stopping backend server..."
    # Send SIGTERM for graceful shutdown
    kill -15 $(cat backend.pid)
    
    # Wait for process to terminate
    echo "Waiting for backend to shutdown gracefully..."
    for i in {1..10}; do
        if ! ps -p $(cat backend.pid) > /dev/null; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p $(cat backend.pid) > /dev/null; then
        echo "Force stopping backend server..."
        kill -9 $(cat backend.pid)
    fi
    
    rm backend.pid
else
    # Fallback to kill by port
    echo "No PID file found, stopping by port..."
    PID=$(lsof -t -i:4000)
    if [ -n "$PID" ]; then
        kill -15 $PID
        sleep 2
        if ps -p $PID > /dev/null; then
            kill -9 $PID
        fi
    fi
fi

# Stop frontend server
if [ -f frontend.pid ]; then
    echo "Stopping frontend server..."
    # Send SIGTERM for graceful shutdown
    kill -15 $(cat frontend.pid)
    
    # Wait for process to terminate
    echo "Waiting for frontend to shutdown gracefully..."
    for i in {1..10}; do
        if ! ps -p $(cat frontend.pid) > /dev/null; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p $(cat frontend.pid) > /dev/null; then
        echo "Force stopping frontend server..."
        kill -9 $(cat frontend.pid)
    fi
    
    rm frontend.pid
else
    # Fallback to kill by port
    echo "No PID file found, stopping by port..."
    PID=$(lsof -t -i:3000)
    if [ -n "$PID" ]; then
        kill -15 $PID
        sleep 2
        if ps -p $PID > /dev/null; then
            kill -9 $PID
        fi
    fi
fi

echo "ShiftPlanner application stopped." 
#!/bin/bash
echo "Stopping ShiftPlanner application..."

# Stop backend server
if [ -f backend.pid ]; then
    echo "Stopping backend server..."
    kill $(cat backend.pid)
    rm backend.pid
else
    # Fallback to kill by port
    lsof -t -i:4000 | xargs kill -9 2>/dev/null
fi

# Stop frontend server
if [ -f frontend.pid ]; then
    echo "Stopping frontend server..."
    kill $(cat frontend.pid)
    rm frontend.pid
else
    # Fallback to kill by port
    lsof -t -i:3000 | xargs kill -9 2>/dev/null
fi

echo "ShiftPlanner application stopped." 
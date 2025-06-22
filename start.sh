#!/bin/bash
echo "Starting ShiftPlanner application..."

# Start backend server
echo "Starting backend server..."
cd backend
nohup npm run dev > ../backend.log 2>&1 &
echo $! > ../backend.pid
cd ..

# Start frontend server
echo "Starting frontend server..."
cd frontend
nohup npm start > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..

echo "ShiftPlanner application started."
echo "Backend logs: backend.log"
echo "Frontend logs: frontend.log"
echo "Frontend is available at http://localhost:3000" 
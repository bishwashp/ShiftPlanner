#!/bin/bash
echo "Starting ShiftPlanner application..."

# Start backend server
echo "Starting backend server..."
cd backend

# Clean any stale compiled files
echo "Cleaning dist directory..."
npm run clean

# Start in development mode with proper TypeScript handling
echo "Starting TypeScript server in dev mode..."
nohup npm run dev > ../backend.log 2>&1 &
BACKEND_NPM_PID=$!
echo $BACKEND_NPM_PID > ../backend.pid
cd ..

# Start frontend server
echo "Starting frontend server..."
cd frontend
nohup npm start > ../frontend.log 2>&1 &
FRONTEND_NPM_PID=$!
echo $FRONTEND_NPM_PID > ../frontend.pid
cd ..

echo "ShiftPlanner application started."
echo "Backend logs: backend.log"
echo "Frontend logs: frontend.log"
echo "Frontend is available at http://localhost:3000" 
#!/bin/bash
echo "Restarting the frontend development server..."

# Find and kill the process running on port 3000
PID=$(lsof -t -i:3000)
if [ -n "$PID" ]; then
  echo "Killing process $PID on port 3000"
  kill -9 $PID
else
  echo "No process found on port 3000."
fi

# Start the frontend server
echo "Starting the frontend server..."
cd frontend
npm start 
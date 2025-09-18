#!/bin/bash
echo "Restarting ShiftPlanner application..."

# Stop the application
echo "Stopping current services..."
./stop.sh

# Wait a moment to ensure everything is stopped
sleep 3

# Start the application
echo "Starting services..."
./start.sh

echo "ShiftPlanner application restarted." 
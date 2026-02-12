#!/bin/bash

# Mini Hafsa Startup Script

echo "🚀 Starting Mini Hafsa - Personal AI Employee..."

# Start the backend server
echo "🔌 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!

# Give the backend a moment to start
sleep 3

# Start the frontend server
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Function to stop the servers
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID
    exit 0
}

# Trap Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
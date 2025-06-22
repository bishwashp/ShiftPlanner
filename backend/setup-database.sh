#!/bin/bash

echo "🚀 ShiftPlanner Database Setup"
echo "================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/shiftplanner"

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Optional: Logging
LOG_LEVEL=debug
EOF
    echo "✅ .env file created!"
    echo "⚠️  Please edit .env with your actual database credentials"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your PostgreSQL credentials"
echo "2. Make sure PostgreSQL is running"
echo "3. Create a database named 'shiftplanner'"
echo "4. Run: npx prisma migrate dev"
echo "5. Run: npm run dev"
echo ""
echo "🔧 Database setup commands:"
echo "   # Create database (if using psql)"
echo "   createdb shiftplanner"
echo ""
echo "   # Or connect to PostgreSQL and run:"
echo "   CREATE DATABASE shiftplanner;" 
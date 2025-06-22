# ShiftPlanner Backend

## Setup Instructions

### 1. Environment Configuration
Create a `.env` file in the backend directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/shiftplanner"

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Optional: Logging
LOG_LEVEL=debug
```

### 2. Database Setup
1. Install PostgreSQL and create a database named `shiftplanner`
2. Run the following commands:

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed the database
npx prisma db seed
```

### 3. Start the Server
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Analysts
- `GET /api/analysts` - Get all analysts
- `GET /api/analysts/:id` - Get analyst by ID
- `POST /api/analysts` - Create new analyst
- `PUT /api/analysts/:id` - Update analyst
- `DELETE /api/analysts/:id` - Delete analyst
- `GET /api/analysts/:id/preferences` - Get analyst preferences
- `POST /api/analysts/:id/preferences` - Update analyst preferences

### Schedules
- `GET /api/schedules` - Get schedules (with optional date filtering)
- `GET /api/schedules/:id` - Get schedule by ID
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/bulk` - Bulk create schedules

### Algorithms
- `GET /api/algorithms` - Get all algorithm configurations
- `GET /api/algorithms/:id` - Get algorithm by ID
- `POST /api/algorithms` - Create new algorithm configuration
- `PUT /api/algorithms/:id` - Update algorithm configuration
- `DELETE /api/algorithms/:id` - Delete algorithm configuration
- `POST /api/algorithms/:id/activate` - Activate algorithm configuration
- `GET /api/algorithms/active/current` - Get active algorithm configuration

## Development

The backend is built with:
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing 
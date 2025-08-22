# ShiftPlanner

An advanced scheduling system designed to automate the creation of equitable work schedules for Analysts working in morning and evening shifts, with both regular and Screener roles.

## Features

- **Automated Schedule Generation**: Creates equitable work schedules based on complex constraints
- **Shift Rotation Patterns**: Sunday-Thursday, Monday-Friday, Tuesday-Saturday rotations
- **Screener Assignment**: Intelligent assignment of Screener roles with fairness algorithms
- **Analytics Dashboard**: Workload distribution and fairness metrics
- **Modular Architecture**: Extensible system for new scheduling algorithms and constraints
- **Real-time Collaboration**: Multi-user editing with conflict resolution

## Tech Stack

### Backend
- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **Prisma** ORM with **PostgreSQL**
- **Helmet** for security
- **CORS** for cross-origin requests

### Frontend
- **React** with **TypeScript**
- **Tailwind CSS** for styling
- **Modern UI/UX** with responsive design

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ShiftPlanner
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   
   # Create .env file with your database credentials
   cp .env.example .env
   # Edit .env with your actual database URL
   
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   
   # Start the development server
   npm run dev
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   
   # Start the development server
   npm start
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health

## API Documentation

### Health Check
- `GET /health` - Server health status

### Analysts
- `GET /api/analysts` - Get all analysts
- `POST /api/analysts` - Create new analyst
- `PUT /api/analysts/:id` - Update analyst
- `DELETE /api/analysts/:id` - Delete analyst

### Schedules
- `GET /api/schedules` - Get schedules with optional filtering
- `POST /api/schedules` - Create new schedule
- `POST /api/schedules/bulk` - Bulk create schedules

### Algorithms
- `GET /api/algorithms` - Get algorithm configurations
- `POST /api/algorithms` - Create new algorithm configuration
- `POST /api/algorithms/:id/activate` - Activate algorithm

## Project Structure

```
ShiftPlanner/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── app.ts          # Express app setup
│   │   └── index.ts        # Server entry point
│   ├── prisma/             # Database schema and migrations
│   └── README.md           # Backend setup instructions
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   └── App.tsx         # Main app component
│   └── README.md           # Frontend setup instructions
├── PROJECT_STATUS.md       # Current project status and next steps
├── shiftPlannerRequirements.md  # Detailed requirements document
└── README.md               # This file
```

## Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm start           # Start production server
```

### Frontend Development
```bash
cd frontend
npm start           # Start development server
npm run build       # Build for production
npm test           # Run tests
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please refer to the [PROJECT_STATUS.md](PROJECT_STATUS.md) file for current development status and next steps. 
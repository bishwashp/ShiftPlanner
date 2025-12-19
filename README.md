# ShiftPlanner v0.9.7

An advanced, production-ready scheduling system designed to automate the creation of equitable work schedules for Analysts working in morning and evening shifts, with intelligent Screener role assignment and comprehensive absence management.

## 🚀 v0.9.7 Highlights

- **⚡ 8-28ms Response Times** - Ultra-fast performance with optimized SQLite + in-memory caching
- **🎯 Zero External Dependencies** - Self-contained architecture with no Redis or PostgreSQL requirements
- **🧠 Intelligent Scheduling** - Advanced algorithms with fairness optimization and constraint handling
- **📊 Enhanced Analytics** - Analyst fairness distribution, weekend tracking, and workload trend analysis
- **🏖️ Absence Management** - Automatic shift reassignment with disruptive shift detection
- **📅 AM-to-PM Rotation** - Implemented rotation strategy for workload balance
- **🔒 Production Security** - Helmet, CORS, rate limiting, and comprehensive audit logging
- **📡 GraphQL + REST APIs** - Dual API architecture for maximum flexibility

## ✨ Core Features

### Scheduling Engine
- **Automated Schedule Generation** - Creates equitable work schedules based on complex constraints
- **Multiple Shift Patterns** - Sunday-Thursday, Monday-Friday, Tuesday-Saturday rotations
- **AM-to-PM Rotation** - Intelligent rotation from morning to evening shifts for fairness
- **Intelligent Screener Assignment** - Fairness algorithms ensure equitable distribution
- **Absence Management** - Automatic schedule updates for approved absences with replacement logic
- **Constraint Management** - Vacation handling, blackout dates, preferences, and availability
- **Algorithm Registry** - Extensible system supporting multiple scheduling algorithms

### Analytics & Monitoring
- **Analyst Fairness Distribution** - Weighted workload analysis with fairness scoring
- **Weekend Tracking** - Dedicated metrics for weekend shift distribution
- **Workload Trend Analysis** - Historical tracking of shift assignments and patterns
- **Performance Monitoring** - Query optimization, cache hit rates, and response time tracking
- **Audit Logging** - Comprehensive security and activity monitoring
- **Health Checks** - Database, cache, and GraphQL endpoint monitoring

### User Experience
- **Modern React 19 UI** - Responsive design with Tailwind CSS and Roboto Flex typography
- **Interactive Calendar** - Full-featured schedule viewing and management
- **Dark/Light Themes** - Professional UI with seamless theme switching
- **Real-time Updates** - Live data synchronization across users
- **Glass Morphism Design** - Premium UI aesthetics with modern design patterns

### Authentication & Security
- **Role-Based Access Control (RBAC)** - Two-tier system (Analyst/Manager) with strict permission enforcement
- **Secure Authentication** - JWT-based session management with bcrypt password hashing
- **Protected API** - Middleware-enforced route protection and resource ownership checks
- **Audit Ready** - Comprehensive logging of authentication events and sensitive actions

## 🏗️ Architecture

### Backend Stack
- **Node.js** with **Express.js** - High-performance REST API server
- **TypeScript** - Full type safety and modern development experience
- **Prisma ORM** with **SQLite** - Optimized database with zero configuration
- **In-Memory Caching** - High-speed cache with 300-3600s TTL configuration
- **Apollo GraphQL** - Advanced GraphQL server with DataLoader optimization
- **Security Stack** - Helmet, CORS, compression, and rate limiting

### Frontend Stack
- **React 19** with **TypeScript** - Modern component architecture
- **Tailwind CSS** - Utility-first styling with responsive design
- **Framer Motion** - Smooth animations and transitions
- **Heroicons** - Consistent icon system
- **Recharts** - Advanced data visualization
- **Moment.js** - Advanced date/time handling with timezone support

### Performance Architecture
```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend (React)  │    │  Backend (Node.js)   │    │  Database (SQLite)  │
│                     │    │                      │    │                     │
│ • Tailwind CSS     │◄──►│ • Express + GraphQL  │◄──►│ • Optimized Schema  │
│ • Real-time UI     │    │ • In-Memory Cache    │    │ • Performance Index │
│ • Theme Support    │    │ • Security Layer     │    │ • Query Monitoring  │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                          ⚡ 8-28ms Response Times
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **No external databases required** - SQLite included

### Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd ShiftPlanner
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Generate Prisma client and setup SQLite database
   npx prisma generate
   npx prisma migrate dev
   
   # Start development server
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   # Start development server  
   npm start
   ```

4. **Access Application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:4000/api
   - **GraphQL Playground**: http://localhost:4000/graphql
   - **Health Dashboard**: http://localhost:4000/health

## 🔧 Development

### Quick Commands
```bash
# From project root:

# Start full application (both frontend and backend)
npm run full:start

# Backend only
npm run backend

# Frontend only  
npm start

# Build for production
npm run build

# Kill all processes
npm run full:kill

# Restart services
npm run full:restart
```

### Script Organization
All operational scripts are now organized in the `scripts/` directory:

```bash
# Production scripts
./scripts/start.sh      # Start backend services
./scripts/stop.sh       # Stop running services
./scripts/restart.sh    # Restart services

# Development scripts (scripts/dev/)
# - Database maintenance utilities
# - Testing and debugging tools
# - Data cleanup scripts
```

### Environment Setup
The application works out-of-the-box with SQLite. For production deployment:

```bash
# Backend environment (optional)
DATABASE_URL="file:./dev.db"
FRONTEND_URL="http://localhost:3000"
NODE_ENV="production"
PORT=4000
```

## 📡 API Documentation

### REST Endpoints

#### Core Resources
```
GET    /health                    # System health and performance metrics
GET    /api/analysts              # Get all analysts with filtering
POST   /api/analysts              # Create new analyst
PUT    /api/analysts/:id          # Update analyst details
DELETE /api/analysts/:id          # Delete analyst

GET    /api/schedules             # Get schedules with date filtering  
POST   /api/schedules             # Create schedule entry
POST   /api/schedules/bulk        # Bulk schedule operations

GET    /api/absences              # Get absence requests
POST   /api/absences              # Submit absence request
PUT    /api/absences/:id/approve  # Approve absence (triggers auto-reassignment)

GET    /api/algorithms            # Get algorithm configurations
POST   /api/algorithms            # Create algorithm config
POST   /api/algorithms/:id/activate  # Activate scheduling algorithm

GET    /api/analytics             # Analytics and metrics data
GET    /api/constraints           # Scheduling constraints
POST   /api/constraints           # Create new constraint
```

#### Monitoring & Health
```
GET    /health/db-performance     # Database query metrics
GET    /health/cache-performance  # Cache hit rates and stats
GET    /health/graphql-performance # GraphQL performance metrics  
POST   /health/warm-cache         # Warm cache with frequent data
```

### GraphQL API

Access the interactive GraphQL Playground at `/graphql`

#### Sample Queries
```graphql
# System Health
query SystemHealth {
  health {
    status
    database { performance { averageDuration totalQueries } }
    cache { stats { keys hitRate } }
  }
}

# Analyst Management with Fairness Metrics
query GetAnalysts {
  analysts {
    id name email shiftType isActive
    totalWorkDays screenerDays fairnessScore
    preferences { shiftType dayOfWeek preference }
  }
}

# Schedule Generation Preview
query SchedulePreview {
  generateSchedulePreview(input: {
    startDate: "2025-01-01"
    endDate: "2025-01-07" 
    algorithmType: "WeekendRotationAlgorithm"
  }) {
    summary { totalDays fairnessScore executionTime }
    fairnessMetrics { overallFairnessScore recommendations }
    performanceMetrics { algorithmExecutionTime memoryUsage }
  }
}
```

## 🏢 Project Structure

```
ShiftPlanner/
├── 📁 backend/                     # Express.js + GraphQL API Server
│   ├── 📁 src/
│   │   ├── 📁 routes/             # REST API route handlers
│   │   ├── 📁 graphql/            # GraphQL schema and resolvers
│   │   ├── 📁 services/           # Business logic services  
│   │   │   ├── AbsenceService.ts  # Absence request handling
│   │   │   ├── ReplacementService.ts # Auto-replacement logic
│   │   │   └── SchedulingService.ts  # Schedule generation
│   │   ├── 📁 lib/                # Database and cache utilities
│   │   ├── app.ts                 # Express application setup
│   │   └── index.ts               # Server entry point
│   ├── 📁 prisma/                 # SQLite database schema
│   │   ├── schema.prisma          # Database models and indexes
│   │   └── migrations/            # Database migration files
│   └── package.json               # Backend dependencies
│
├── 📁 frontend/                    # React TypeScript Application  
│   ├── 📁 src/
│   │   ├── 📁 components/         # React components
│   │   │   ├── 📁 layout/         # Layout components
│   │   │   │   ├── Dashboard.tsx  # Main dashboard
│   │   │   │   ├── Analytics.tsx  # Analytics page
│   │   │   │   └── Calendar.tsx   # Calendar view
│   │   │   ├── 📁 ui/             # Reusable UI components
│   │   │   └── 📁 widgets/        # Dashboard widgets
│   │   ├── 📁 services/           # API integration
│   │   ├── 📁 utils/              # Utility functions
│   │   └── App.tsx                # Main application component
│   ├── 📁 public/                 # Static assets
│   │   └── SP.png                 # App icon
│   └── package.json               # Frontend dependencies
│
├── 📁 scripts/                     # Operational scripts
│   ├── start.sh                   # Start services
│   ├── stop.sh                    # Stop services
│   ├── restart.sh                 # Restart services
│   ├── 📁 dev/                    # Development utilities
│   └── 📁 archive/                # Historical scripts
│
├── 📁 docs/                        # Documentation
│   └── 📁 archive/                # Historical planning documents
│
├── 📁 monitoring/                  # Optional monitoring stack
│   ├── prometheus.yml             # Metrics collection
│   └── grafana/                   # Performance dashboards
│
├── package.json                   # Root project configuration
├── README.md                      # This documentation
└── shiftPlannerRequirements.md    # Detailed requirements
```

## ⚡ Performance & Optimization

### Response Time Metrics
- **API Endpoints**: 8-28ms average response time
- **GraphQL Queries**: Optimized with DataLoader (sub-10ms for cached)
- **Database Queries**: SQLite with performance indexes (1-15ms)
- **Cache Hit Rate**: 85-95% for frequent operations

### Optimization Features
- **In-Memory Caching** - 300-3600s TTL based on data type
- **Query Optimization** - Prisma with performance monitoring
- **Compression** - Gzip compression for API responses
- **Database Indexes** - Optimized indexes for common queries
- **Connection Pooling** - Efficient database connection management

### Monitoring Dashboard
Access real-time metrics:
```bash
# Performance metrics
curl http://localhost:4000/health/db-performance
curl http://localhost:4000/health/cache-performance

# System health
curl http://localhost:4000/health
```

## 🔒 Security Features

- **Helmet.js** - Security headers and CSP protection
- **CORS Configuration** - Configurable cross-origin request handling  
- **Rate Limiting** - API endpoint protection (configurable limits)
- **Audit Logging** - Comprehensive security event tracking
- **Input Validation** - TypeScript + Prisma validation
- **Error Handling** - Secure error responses (no stack traces in production)

## 🧠 Scheduling Algorithms

### Available Algorithms
- **WeekendRotationAlgorithm** - Optimized weekend shift distribution
- **AM-to-PM Rotation** - Automatic rotation from morning to evening shifts
- **ConstraintEngine** - Advanced constraint satisfaction
- **FairnessEngine** - Workload equity optimization
- **OptimizationEngine** - Multi-objective schedule optimization

### Algorithm Features
- **Fairness Scoring** - Mathematical fairness calculation with weighted workload
- **Constraint Satisfaction** - Vacation, preference, and availability handling
- **Absence Handling** - Automatic shift reassignment for approved absences
- **Performance Optimization** - Sub-100ms algorithm execution
- **Extensible Architecture** - Plugin system for custom algorithms

### Absence Management
- **Disruptive Shift Detection** - Identifies screener and weekend shifts
- **Automatic Replacement** - Intelligent analyst reassignment
- **Fairness Preservation** - Maintains overall schedule equity
- **Conflict Prevention** - Validates replacement availability

## 🚦 Production Deployment

### Build Commands
```bash
# Frontend production build
cd frontend && npm run build

# Backend production build  
cd backend && npm run build && npm start

# Or use convenience scripts
npm run build
```

### Production Considerations
- SQLite database included (no external DB setup required)
- In-memory cache (no Redis installation needed)
- Environment variables for security configuration
- Health check endpoints for load balancer integration
- Graceful shutdown handling
- Compression and performance optimization enabled

## 📊 Monitoring & Analytics

### Built-in Metrics
- Database query performance and slow query detection
- Cache hit rates and memory usage statistics
- API response times and error rates
- GraphQL query performance and complexity analysis
- Security event logging and audit trails
- Analyst fairness distribution and workload trends
- Weekend shift tracking and rotation metrics

### Health Check Endpoints
- `/health` - Overall system status
- `/health/db-performance` - Database metrics
- `/health/cache-performance` - Cache statistics
- `/health/graphql-performance` - GraphQL metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)  
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow existing code style and patterns
- Add tests for new features
- Update documentation for API changes
- Ensure performance benchmarks are maintained
- Run linting before committing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚀 Version History

### v0.9.7 (Current)
- ✅ Repository cleanup and organization
- ✅ Enhanced analytics with fairness distribution
- ✅ Improved absence management
- ✅ AM-to-PM rotation implementation
- ✅ UI/UX refinements with Roboto Flex typography
- ✅ Organized scripts and documentation structure

### v0.9.6
- Analytics refactoring
- Weekend tracking implementation
- Calendar UI improvements

### v0.7 (MVP)
- Initial production release
- Core scheduling engine
- GraphQL + REST APIs
- Zero-dependency architecture

---

**Production Ready** ✅
- Zero external dependencies for core functionality
- 8-28ms response times achieved  
- Comprehensive security and monitoring
- SQLite + in-memory architecture optimized
- Full GraphQL + REST API coverage
- Modern React UI with professional glass-morphism design
- Advanced absence management with auto-replacement
- Analyst fairness distribution tracking
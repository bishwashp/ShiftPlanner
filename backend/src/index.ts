import { app, httpServer } from './app';
import { createApolloServer, startApolloServer } from './graphql/server';
import { prisma } from './lib/prisma';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    console.log('🚀 Starting ShiftPlanner server...');
    
    // Create and start Apollo Server
    console.log('📊 Initializing GraphQL server...');
    const apolloServer = await createApolloServer();
    await startApolloServer(apolloServer, app, httpServer);
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`🔗 API endpoints available at http://localhost:${PORT}/api`);
      console.log(`📚 GraphQL Playground available at http://localhost:${PORT}/graphql`);
      console.log(`🔗 GraphQL endpoint available at http://localhost:${PORT}/graphql`);
    });
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      // Close HTTP server
      httpServer.close(() => {
        console.log('🔌 HTTP server closed');
      });
      
      // Close Apollo Server
      await apolloServer.stop();
      console.log('🔌 Apollo Server stopped');
      
      // Close database connection
      await prisma.$disconnect();
      console.log('🔌 Database disconnected');
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    console.log('✅ Server started successfully!');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

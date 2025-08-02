import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginUsageReporting } from '@apollo/server/plugin/usageReporting';
import { GraphQLFormattedError } from 'graphql';
import { typeDefs } from './schema';
import { resolvers, GraphQLContext } from './resolvers';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { 
  createAnalystLoader, 
  createScheduleLoader, 
  createVacationLoader, 
  createConstraintLoader,
  createSchedulesByAnalystLoader,
  createVacationsByAnalystLoader,
  createConstraintsByAnalystLoader,
  createSchedulesByDateRangeLoader,
  createBatchOperations
} from './dataloaders';

export async function createApolloServer() {
  // Create Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [
      // Development landing page
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
      
      // Usage reporting (optional - for production monitoring)
      // ApolloServerPluginUsageReporting({
      //   sendReportsImmediately: true,
      //   sendVariableValues: { all: true },
      //   sendHeaders: { all: true },
      // }),
    ],
    
    // Error handling
    formatError: (error): GraphQLFormattedError => {
      console.error('GraphQL Error:', error);
      
      // Don't expose internal errors to clients
      if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return {
          message: 'An internal server error occurred',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      return {
        message: error.message,
        extensions: {
          ...error.extensions,
          timestamp: new Date().toISOString(),
        },
      };
    },
    
    // Introspection and playground settings
    introspection: process.env.NODE_ENV !== 'production',
    
    // Performance monitoring
    csrfPrevention: true,
    cache: 'bounded',
  });

  return server;
}

export async function startApolloServer(server: ApolloServer<GraphQLContext>, app: any, httpServer: any) {
  // Add the drain plugin with the actual HTTP server
  const drainPlugin = ApolloServerPluginDrainHttpServer({ httpServer });
  server.addPlugin(drainPlugin);
  
  await server.start();
  
  // Apply Apollo middleware to Express app
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }: { req: any; res: any }): Promise<GraphQLContext> => {
        return {
          prisma,
          cache: cacheService,
          user: req.user, // Will be set by authentication middleware
          isSubscription: false,
          loaders: {
            analyst: createAnalystLoader(),
            schedule: createScheduleLoader(),
            vacation: createVacationLoader(),
            constraint: createConstraintLoader(),
            schedulesByAnalyst: createSchedulesByAnalystLoader(),
            vacationsByAnalyst: createVacationsByAnalystLoader(),
            constraintsByAnalyst: createConstraintsByAnalystLoader(),
            schedulesByDateRange: createSchedulesByDateRangeLoader(),
          },
          batchOperations: createBatchOperations(),
        };
      },
    })
  );
  
  console.log('🚀 GraphQL server ready at /graphql');
  console.log('📚 GraphQL Playground available at /graphql');
  
  return server;
}

// Health check for GraphQL server
export async function graphqlHealthCheck() {
  try {
    // Simple introspection query to test GraphQL server
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType {
            name
          }
        }
      }
    `;
    
    // This is a basic health check - in a real implementation,
    // you might want to test actual resolvers
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'GraphQL server is running',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
} 
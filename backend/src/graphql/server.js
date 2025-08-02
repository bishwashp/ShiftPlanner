"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApolloServer = createApolloServer;
exports.startApolloServer = startApolloServer;
exports.graphqlHealthCheck = graphqlHealthCheck;
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const default_1 = require("@apollo/server/plugin/landingPage/default");
const schema_1 = require("./schema");
const resolvers_1 = require("./resolvers");
const prisma_1 = require("../lib/prisma");
const cache_1 = require("../lib/cache");
const dataloaders_1 = require("./dataloaders");
function createApolloServer() {
    return __awaiter(this, void 0, void 0, function* () {
        // Create Apollo Server
        const server = new server_1.ApolloServer({
            typeDefs: schema_1.typeDefs,
            resolvers: resolvers_1.resolvers,
            plugins: [
                // Development landing page
                (0, default_1.ApolloServerPluginLandingPageLocalDefault)({ embed: true }),
                // Usage reporting (optional - for production monitoring)
                // ApolloServerPluginUsageReporting({
                //   sendReportsImmediately: true,
                //   sendVariableValues: { all: true },
                //   sendHeaders: { all: true },
                // }),
            ],
            // Error handling
            formatError: (error) => {
                var _a;
                console.error('GraphQL Error:', error);
                // Don't expose internal errors to clients
                if (((_a = error.extensions) === null || _a === void 0 ? void 0 : _a.code) === 'INTERNAL_SERVER_ERROR') {
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
                    extensions: Object.assign(Object.assign({}, error.extensions), { timestamp: new Date().toISOString() }),
                };
            },
            // Introspection and playground settings
            introspection: process.env.NODE_ENV !== 'production',
            // Performance monitoring
            csrfPrevention: true,
            cache: 'bounded',
        });
        return server;
    });
}
function startApolloServer(server, app, httpServer) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add the drain plugin with the actual HTTP server
        const drainPlugin = (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer });
        server.addPlugin(drainPlugin);
        yield server.start();
        // Apply Apollo middleware to Express app
        app.use('/graphql', (0, express4_1.expressMiddleware)(server, {
            context: (_a) => __awaiter(this, [_a], void 0, function* ({ req, res }) {
                return {
                    prisma: prisma_1.prisma,
                    cache: cache_1.cacheService,
                    user: req.user, // Will be set by authentication middleware
                    isSubscription: false,
                    loaders: {
                        analyst: (0, dataloaders_1.createAnalystLoader)(),
                        schedule: (0, dataloaders_1.createScheduleLoader)(),
                        vacation: (0, dataloaders_1.createVacationLoader)(),
                        constraint: (0, dataloaders_1.createConstraintLoader)(),
                        schedulesByAnalyst: (0, dataloaders_1.createSchedulesByAnalystLoader)(),
                        vacationsByAnalyst: (0, dataloaders_1.createVacationsByAnalystLoader)(),
                        constraintsByAnalyst: (0, dataloaders_1.createConstraintsByAnalystLoader)(),
                        schedulesByDateRange: (0, dataloaders_1.createSchedulesByDateRangeLoader)(),
                    },
                    batchOperations: (0, dataloaders_1.createBatchOperations)(),
                };
            }),
        }));
        console.log('🚀 GraphQL server ready at /graphql');
        console.log('📚 GraphQL Playground available at /graphql');
        return server;
    });
}
// Health check for GraphQL server
function graphqlHealthCheck() {
    return __awaiter(this, void 0, void 0, function* () {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
}

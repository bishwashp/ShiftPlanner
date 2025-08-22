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
const app_1 = require("./app");
const server_1 = require("./graphql/server");
const prisma_1 = require("./lib/prisma");
const PORT = process.env.PORT || 4000;
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🚀 Starting ShiftPlanner server...');
            // Create and start Apollo Server
            console.log('📊 Initializing GraphQL server...');
            const apolloServer = yield (0, server_1.createApolloServer)();
            yield (0, server_1.startApolloServer)(apolloServer, app_1.app, app_1.httpServer);
            // Start HTTP server
            app_1.httpServer.listen(PORT, () => {
                console.log(`🚀 Server running on port ${PORT}`);
                console.log(`📊 Health check available at http://localhost:${PORT}/health`);
                console.log(`🔗 API endpoints available at http://localhost:${PORT}/api`);
                console.log(`📚 GraphQL Playground available at http://localhost:${PORT}/graphql`);
                console.log(`🔗 GraphQL endpoint available at http://localhost:${PORT}/graphql`);
            });
            // Graceful shutdown
            const gracefulShutdown = (signal) => __awaiter(this, void 0, void 0, function* () {
                console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
                // Close HTTP server
                app_1.httpServer.close(() => {
                    console.log('🔌 HTTP server closed');
                });
                // Close Apollo Server
                yield apolloServer.stop();
                console.log('🔌 Apollo Server stopped');
                // Close database connection
                yield prisma_1.prisma.$disconnect();
                console.log('🔌 Database disconnected');
                console.log('✅ Graceful shutdown completed');
                process.exit(0);
            });
            // Handle shutdown signals
            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));
            console.log('✅ Server started successfully!');
        }
        catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    });
}
startServer();

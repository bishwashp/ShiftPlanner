import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface UserConnection {
    socketId: string;
    userId?: string;
    analystId?: string;
    role?: string;
    connectedAt: Date;
}

class WebSocketService {
    private io: SocketIOServer | null = null;
    private connections: Map<string, UserConnection> = new Map();

    /**
     * Initialize WebSocket server
     */
    initialize(httpServer: HTTPServer): void {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                credentials: true,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.io.on('connection', (socket: Socket) => {
            this.handleConnection(socket);
        });

        console.log('✅ WebSocket service initialized');
    }

    /**
     * Handle new WebSocket connection
     */
    private handleConnection(socket: Socket): void {
        const { userId, analystId, role } = socket.handshake.auth;

        console.log(`[WebSocket] New connection: ${socket.id}`, {
            userId,
            analystId,
            role
        });

        // Store connection info
        this.connections.set(socket.id, {
            socketId: socket.id,
            userId,
            analystId,
            role,
            connectedAt: new Date()
        });

        // Send connection confirmation
        socket.emit('connected', {
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`, { reason });
            this.connections.delete(socket.id);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`[WebSocket] Socket error: ${socket.id}`, error);
        });

        // Log connection stats
        console.log(`[WebSocket] Total connections: ${this.connections.size}`);
    }

    /**
     * Emit notification to a specific user (manager)
     */
    emitToUser(userId: string, event: string, data: any): void {
        if (!this.io) {
            console.warn('[WebSocket] Service not initialized');
            return;
        }

        const targetSockets = Array.from(this.connections.values())
            .filter(conn => conn.userId === userId)
            .map(conn => conn.socketId);

        if (targetSockets.length === 0) {
            console.log(`[WebSocket] No active connections for user ${userId}`);
            return;
        }

        targetSockets.forEach(socketId => {
            this.io?.to(socketId).emit(event, data);
        });

        console.log(`[WebSocket] Emitted ${event} to user ${userId} (${targetSockets.length} connections)`);
    }

    /**
     * Emit notification to a specific analyst
     */
    emitToAnalyst(analystId: string, event: string, data: any): void {
        if (!this.io) {
            console.warn('[WebSocket] Service not initialized');
            return;
        }

        const targetSockets = Array.from(this.connections.values())
            .filter(conn => conn.analystId === analystId)
            .map(conn => conn.socketId);

        if (targetSockets.length === 0) {
            console.log(`[WebSocket] No active connections for analyst ${analystId}`);
            return;
        }

        targetSockets.forEach(socketId => {
            this.io?.to(socketId).emit(event, data);
        });

        console.log(`[WebSocket] Emitted ${event} to analyst ${analystId} (${targetSockets.length} connections)`);
    }

    /**
     * Emit notification to specific roles
     */
    emitToRoles(roles: string[], event: string, data: any): void {
        if (!this.io) {
            console.warn('[WebSocket] Service not initialized');
            return;
        }

        const targetSockets = Array.from(this.connections.values())
            .filter(conn => conn.role && roles.includes(conn.role))
            .map(conn => conn.socketId);

        if (targetSockets.length === 0) {
            console.log(`[WebSocket] No active connections for roles: ${roles.join(', ')}`);
            return;
        }

        targetSockets.forEach(socketId => {
            this.io?.to(socketId).emit(event, data);
        });

        console.log(`[WebSocket] Emitted ${event} to roles ${roles.join(', ')} (${targetSockets.length} connections)`);
    }

    /**
     * Broadcast to all connected clients
     */
    emitToAll(event: string, data: any): void {
        if (!this.io) {
            console.warn('[WebSocket] Service not initialized');
            return;
        }

        this.io.emit(event, data);
        console.log(`[WebSocket] Broadcasted ${event} to all clients (${this.connections.size} connections)`);
    }

    /**
     * Get connection statistics
     */
    getStats(): {
        totalConnections: number;
        userConnections: number;
        analystConnections: number;
    } {
        const connections = Array.from(this.connections.values());
        return {
            totalConnections: connections.length,
            userConnections: connections.filter(c => c.userId).length,
            analystConnections: connections.filter(c => c.analystId).length
        };
    }

    /**
     * Close all connections
     */
    close(): void {
        if (this.io) {
            this.io.close();
            this.connections.clear();
            console.log('[WebSocket] Service closed');
        }
    }
}

export const webSocketService = new WebSocketService();

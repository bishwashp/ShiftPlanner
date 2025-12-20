import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface UseWebSocketReturn {
    socket: Socket | null;
    isConnected: boolean;
    on: (event: string, handler: (data: any) => void) => void;
    off: (event: string, handler: (data: any) => void) => void;
    emit: (event: string, data?: any) => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const listenersRef = useRef<Map<string, (data: any) => void>>(new Map());

    useEffect(() => {
        if (!user) {
            // Disconnect if user logs out
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        // Initialize Socket.IO connection
        const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:4000', {
            auth: {
                userId: user.id,
                analystId: user.analystId || undefined
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        socketRef.current = socket;

        // Connection event handlers
        socket.on('connect', () => {
            console.log('[WebSocket] Connected:', socket.id);
            setIsConnected(true);
        });

        socket.on('connected', (data) => {
            console.log('[WebSocket] Connection confirmed:', data);
        });

        socket.on('disconnect', (reason) => {
            console.log('[WebSocket] Disconnected:', reason);
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error);
            setIsConnected(false);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
            setIsConnected(true);
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('[WebSocket] Reconnection attempt:', attemptNumber);
        });

        socket.on('reconnect_error', (error) => {
            console.error('[WebSocket] Reconnection error:', error);
        });

        socket.on('reconnect_failed', () => {
            console.error('[WebSocket] Reconnection failed');
        });

        // Register existing listeners
        listenersRef.current.forEach((handler, event) => {
            socket.on(event, handler);
        });

        // Cleanup on unmount
        return () => {
            console.log('[WebSocket] Cleaning up connection');
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [user]);

    // Function to register event listeners
    const on = useCallback((event: string, handler: (data: any) => void) => {
        // Only one listener per event+handler reference
        const currentHandlers = listenersRef.current.get(event);
        if (currentHandlers === handler) return;

        listenersRef.current.set(event, handler);
        if (socketRef.current) {
            socketRef.current.on(event, handler);
        }
    }, [isConnected]);

    // Function to remove event listeners
    const off = useCallback((event: string, handler: (data: any) => void) => {
        listenersRef.current.delete(event);
        if (socketRef.current) {
            socketRef.current.off(event, handler);
        }
    }, [isConnected]);

    // Function to emit events
    const emit = useCallback((event: string, data?: any) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit(event, data);
        } else {
            console.warn('[WebSocket] Cannot emit - not connected');
        }
    }, [isConnected]);

    return {
        socket: socketRef.current,
        isConnected,
        on,
        off,
        emit
    };
};

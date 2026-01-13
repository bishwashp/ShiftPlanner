import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    analystId: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hasRole: (...roles: string[]) => boolean;
    isAnalyst: boolean;
    isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token and verify with retry logic
        const loadUser = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                const MAX_RETRIES = 3;
                const RETRY_DELAY = 500; // ms

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        const response = await fetch(`${API_URL}/auth/me`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (response.ok) {
                            const data = await response.json();
                            setUser(data.user);
                            break; // Success, exit retry loop
                        } else if (response.status === 401) {
                            // Token is actually invalid, remove it
                            console.log('Auth: Token invalid (401), removing');
                            localStorage.removeItem('authToken');
                            break;
                        } else {
                            // Server error, might be transient
                            console.warn(`Auth: Attempt ${attempt}/${MAX_RETRIES} failed with status ${response.status}`);
                            if (attempt < MAX_RETRIES) {
                                await new Promise(r => setTimeout(r, RETRY_DELAY));
                            }
                        }
                    } catch (error) {
                        // Network error - might be transient (server starting, etc)
                        console.warn(`Auth: Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
                        if (attempt < MAX_RETRIES) {
                            await new Promise(r => setTimeout(r, RETRY_DELAY));
                        } else {
                            // All retries exhausted, but don't remove token - server might just be down
                            console.error('Auth: All retries exhausted, keeping token for when server returns');
                        }
                    }
                }
            }
            setIsLoading(false);
        };

        loadUser();
    }, []);

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        setUser(data.user);
    };

    const logout = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error('Logout request failed:', error);
            }
        }
        localStorage.removeItem('authToken');
        setUser(null);
    };

    const hasRole = (...roles: string[]) => {
        return user ? roles.includes(user.role) : false;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
                hasRole,
                isAnalyst: user?.role === 'ANALYST',
                isManager: user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN'
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

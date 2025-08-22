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
const express_1 = require("express");
const SecurityService_1 = require("../services/SecurityService");
const router = (0, express_1.Router)();
// Login endpoint
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }
        const user = yield SecurityService_1.securityService.authenticateUser(email, password);
        if (!user) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid credentials'
            });
        }
        const authToken = yield SecurityService_1.securityService.generateAuthToken(user, req.ip || 'unknown', req.headers['user-agent'] || '');
        res.json({
            success: true,
            message: 'Authentication successful',
            token: authToken.token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error'
        });
    }
}));
// Logout endpoint
router.post('/logout', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            yield SecurityService_1.securityService.revokeAuthToken(token);
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Logout error',
            message: 'Internal server error'
        });
    }
}));
// Get current user info
router.get('/me', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Bearer token is required'
            });
        }
        const token = authHeader.substring(7);
        const user = yield SecurityService_1.securityService.validateAuthToken(token);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Token is invalid or expired'
            });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            }
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error'
        });
    }
}));
exports.default = router;

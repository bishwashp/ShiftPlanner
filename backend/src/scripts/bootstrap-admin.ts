/**
 * Bootstrap script to create initial admin account
 * Run this ONCE to create the first user who can then invite others
 */

import { prisma } from '../lib/prisma';
import { AuthService } from '../services/AuthService';

const ADMIN_EMAIL = 'admin@shiftplanner.local';
const ADMIN_PASSWORD = 'Admin123!'; // Change this after first login!
const ADMIN_FIRSTNAME = 'System';
const ADMIN_LASTNAME = 'Administrator';

async function createAdminUser() {
    console.log('🚀 Creating initial admin account...');

    try {
        // Check if admin already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: ADMIN_EMAIL }
        });

        if (existingUser) {
            console.log('✓ Admin account already exists!');
            console.log(`  Email: ${existingUser.email}`);
            console.log(`  Role: ${existingUser.role}`);
            return;
        }

        // Create admin account
        const admin = await AuthService.register({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            firstName: ADMIN_FIRSTNAME,
            lastName: ADMIN_LASTNAME,
            role: 'SUPER_ADMIN'
        });

        console.log('\n✅ Admin account created successfully!');
        console.log('=====================================');
        console.log(`Email:    ${admin.email}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log(`Role:     ${admin.role}`);
        console.log('=====================================');
        console.log('\n⚠️  IMPORTANT: Change the password after your first login!');
        console.log('\nYou can now:');
        console.log('1. Start the backend: cd backend && npm run dev');
        console.log('2. Start the frontend: cd frontend && npm start');
        console.log('3. Navigate to http://localhost:3000/login');
        console.log('4. Login with the credentials above');
        console.log('5. Go to User Management to invite team members\n');

    } catch (error) {
        console.error('❌ Error creating admin account:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the bootstrap
createAdminUser()
    .then(() => {
        console.log('✓ Bootstrap completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('✗ Bootstrap failed:', error);
        process.exit(1);
    });

/**
 * Migration script to provision User accounts from existing Analysts
 * Run this once to create initial user accounts
 */

import { prisma } from '../lib/prisma';
import { AuthService } from '../services/AuthService';

const DEFAULT_PASSWORD = 'Welcome123!'; // Users can change this later

async function provisionUserAccounts() {
    console.log('Starting user account provisioning from existing analysts...');

    try {
        // Get all active analysts
        const analysts = await prisma.analyst.findMany({
            where: { isActive: true }
        });

        console.log(`Found ${analysts.length} active analysts to provision`);

        let provisioned = 0;
        let skipped = 0;

        for (const analyst of analysts) {
            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: analyst.email }
            });

            if (existingUser) {
                console.log(`✓ Skipping ${analyst.name} - user already exists`);
                skipped++;
                continue;
            }

            // Extract first and last name from analyst.name
            const names = analyst.name.split(' ');
            const firstName = names[0] || analyst.name;
            const lastName = names.slice(1).join(' ') || 'User';

            // Create user account
            await AuthService.register({
                email: analyst.email,
                password: DEFAULT_PASSWORD,
                firstName,
                lastName,
                role: 'ANALYST', // All analysts get ANALYST role
                analystId: analyst.id
            });

            console.log(`✓ Provisioned account for ${analyst.name} (${analyst.email})`);
            provisioned++;
        }

        console.log('\n=== Provisioning Complete ===');
        console.log(`✓ Provisioned: ${provisioned}`);
        console.log(`- Skipped: ${skipped}`);
        console.log(`\nDefault password for all new accounts: ${DEFAULT_PASSWORD}`);
        console.log('Users should change their password after first login.');

    } catch (error) {
        console.error('Error during provisioning:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
provisionUserAccounts()
    .then(() => {
        console.log('✓ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('✗ Migration failed:', error);
        process.exit(1);
    });

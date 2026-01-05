
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

// const prisma = new PrismaClient();

async function main() {
    const email = 'test_manager@example.com';
    const password = 'Welcome123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        await prisma.user.delete({ where: { email } });
        console.log('Cleaned up existing test user');
    }

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash: hashedPassword,
            firstName: 'Test',
            lastName: 'Manager',
            role: 'MANAGER',
            isActive: true,
            emailVerified: true
        }
    });

    console.log(`Created test manager: ${user.email} / ${password}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());


import { prisma } from '../lib/prisma';

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users found:', users.length);
    users.forEach(u => {
        console.log(`Email: ${u.email}, Role: ${u.role}, Name: ${u.firstName} ${u.lastName}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

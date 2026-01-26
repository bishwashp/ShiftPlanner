
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkConstraints() {
    const analysts = await prisma.analyst.findMany({
        where: {
            name: { in: ['Srujana', 'Bish'] }
        },
        include: {
            constraints: true,
            vacations: true,
            preferences: true,
            absences: true
        }
    });

    console.log(JSON.stringify(analysts, null, 2));
}

checkConstraints()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

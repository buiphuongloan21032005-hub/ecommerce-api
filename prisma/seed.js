const prisma = require('../src/config/prisma');

async function main() {
    // Tạo vai trò nếu chưa có.
    for (const rolename of ['ADMIN', 'normal']) {
        const role = await prisma.role.findFirst({
            where: { rolename }
        });

        if (!role) {
            await prisma.role.create({
                data: { rolename }
            });
        }
    }

    // Hạng mặc định có score = 10.
    const membership = await prisma.memberShip.findFirst({
        where: { mname: 'BASIC' }
    });

    if (membership) {
        await prisma.memberShip.update({
            where: { mid: membership.mid },
            data: { score: 10 }
        });
    } else {
        await prisma.memberShip.create({
            data: {
                mname: 'BASIC',
                score: 10
            }
        });
    }

    console.table(await prisma.role.findMany());
    console.table(await prisma.memberShip.findMany());

    console.log('Seed completed successfully');
}

main()
    .catch((error) => {
        console.error('Seed failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
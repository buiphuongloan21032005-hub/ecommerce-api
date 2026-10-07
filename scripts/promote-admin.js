const prisma = require('../src/config/prisma');

async function main() {
    const username = process.argv[2]?.trim().toLowerCase();

    if (!username) {
        throw new Error(
            'Usage: node scripts/promote-admin.js username'
        );
    }

    const role = await prisma.role.findFirst({
        where: { rolename: 'ADMIN' }
    });

    if (!role) {
        throw new Error(
            'ADMIN role missing. Run npm run seed first'
        );
    }

    const existingUser = await prisma.user.findUnique({
        where: { username }
    });

    if (!existingUser) {
        throw new Error(
            'User not found. Register the account first'
        );
    }

    const user = await prisma.user.update({
        where: { username },
        data: {
            roleid: role.roleid
        },
        select: {
            uid: true,
            username: true,
            role: {
                select: { rolename: true }
            }
        }
    });

    console.log('Admin role assigned successfully');
    console.log(user);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
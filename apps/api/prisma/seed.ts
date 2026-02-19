import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // 1. Find the existing tenant (AI Assist BG)
    let tenant = await prisma.tenant.findFirst({ where: { name: 'AI Assist BG' } });
    if (!tenant) {
        tenant = await prisma.tenant.findFirst();
    }
    if (!tenant) {
        console.error('No tenant found in database. Please create one first.');
        process.exit(1);
    }
    console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

    // 2. Ensure viktor.serafimov@aiassist.bg exists and is ORG_OWNER (Admin tier)
    const adminEmail = 'viktor.serafimov@aiassist.bg';
    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
        const adminPassword = await bcrypt.hash('ChangeMe123!', 10);
        adminUser = await prisma.user.create({
            data: { email: adminEmail, name: 'Viktor Serafimov', password: adminPassword },
        });
        console.log(`Created admin user: ${adminEmail}`);
    } else {
        console.log(`Admin user already exists: ${adminEmail}`);
    }

    // Upsert admin membership to ORG_OWNER
    await prisma.membership.upsert({
        where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
        update: { role: 'ORG_OWNER' },
        create: { userId: adminUser.id, tenantId: tenant.id, role: 'ORG_OWNER' },
    });
    console.log(`${adminEmail} -> ORG_OWNER (Admin tier)`);

    // 3. Create info@universaltrade.com as MEMBER (User tier)
    const userEmail = 'info@universaltrade.com';
    const userPasswordHash = await bcrypt.hash('Password1!', 10);

    let newUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!newUser) {
        newUser = await prisma.user.create({
            data: { email: userEmail, name: 'Universal Trade', password: userPasswordHash },
        });
        console.log(`Created user: ${userEmail}`);
    } else {
        console.log(`User already exists: ${userEmail}`);
    }

    await prisma.membership.upsert({
        where: { userId_tenantId: { userId: newUser.id, tenantId: tenant.id } },
        update: { role: 'MEMBER' },
        create: { userId: newUser.id, tenantId: tenant.id, role: 'MEMBER' },
    });
    console.log(`${userEmail} -> MEMBER (User tier)`);

    console.log('\nSeed complete!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkData() {
    try {
        console.log('Connecting to DB...');

        // 1. Check Tenants
        const tenants = await prisma.tenant.findMany();
        console.log(`Found ${tenants.length} tenants:`);
        tenants.forEach(t => console.log(` - ID: ${t.id}, Name: ${t.name}, API Key: ${t.makeApiKey?.substring(0, 5)}...`));

        if (tenants.length === 0) {
            console.log('No tenants found. Creating a test tenant...');
            const newTenant = await prisma.tenant.create({
                data: {
                    name: "Test Tenant",
                    slug: "test-tenant",
                    makeApiKey: "test-api-key"
                }
            });
            console.log(`Created tenant: ${newTenant.id}`);
        }

        // 2. Check Usage Events
        const events = await prisma.usageEvent.count();
        console.log(`Total UsageEvents: ${events}`);

        const eventsByTenant = await prisma.usageEvent.groupBy({
            by: ['tenantId'],
            _count: true
        });
        console.log('Events by Tenant:', eventsByTenant);

        // 3. Check Aggregates
        const aggregates = await prisma.usageAggregate.count();
        console.log(`Total UsageAggregates: ${aggregates}`);

        const aggsByTenant = await prisma.usageAggregate.groupBy({
            by: ['tenantId', 'date'],
            _sum: { totalCost: true, eventCount: true }
        });
        console.log('Aggregates by Tenant:', aggsByTenant);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();

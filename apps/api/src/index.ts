import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth.js';
import { usageRouter } from './routes/usage.js';
import { eventsRouter } from './routes/events.js';
import { ticketsRouter } from './routes/tickets.js';
import { billingRouter } from './routes/billing.js';
import { documentUsageRouter } from './routes/documentUsage.js';
import { usersRouter } from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

// Make prisma available to routes
app.locals.prisma = prisma;

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { integrationsRouter } from './routes/integrations.js';

// Previous imports...

// ...

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/usage', documentUsageRouter);
app.use('/v1/events', eventsRouter);
app.use('/v1/usage', usageRouter);
app.use('/v1/users', usersRouter);
app.use('/v1/tickets', ticketsRouter);
app.use('/v1/billing', billingRouter);
app.use('/v1/integrations', integrationsRouter);

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Acctos AI API running on port ${PORT}`);
});

export { app, prisma };

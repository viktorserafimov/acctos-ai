# Acctos AI - Client Dashboard

A secure, multi-tenant web dashboard for Acctos AI document processing customers.

## Features

- **Multi-tenant architecture** - Users belong to tenants with RBAC
- **Usage tracking** - Real-time monitoring via event ingestion
- **Billing integration** - Stripe-ready subscription management
- **Support tickets** - Full ticketing system with attachments

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or use Docker)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

## Quick Start

### One-Command Start 🚀

We've simplified the startup process. Just run:

```bash
npm run start:project
```

This will automatically:
1. Start the PostgreSQL database (via Docker)
2. Push the database schema
3. Start both the API and Web App

### Manual Setup (Alternative)

1. **Start Database**
   ```bash
   docker-compose up -d
   ```

2. **Initialize Database**
   ```bash
   npm run db:push
   ```

3. **Start Development Servers**
   ```bash
   npm run dev
   ```

   This starts:
   - API at http://localhost:5000
   - Web at http://localhost:5173

## Project Structure

```
acctos-ai/
├── apps/
│   ├── api/           # TypeScript Express API
│   │   ├── prisma/    # Database schema
│   │   └── src/       # API source
│   └── web/           # React + Vite frontend
│       └── src/       # React components
├── packages/
│   └── types/         # Shared TypeScript types
└── package.json       # Workspace root
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create user + tenant
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user
- `POST /api/auth/switch-tenant` - Change active tenant

### Event Ingestion (for Make.com)
- `POST /v1/events/ingest` - Submit usage event (requires HMAC)

### Usage
- `GET /v1/usage/summary` - Aggregated usage stats
- `GET /v1/usage/timeseries` - Daily usage for charts
- `GET /v1/usage/exports` - CSV export

### Billing
- `GET /v1/billing/plans` - Available plans
- `GET /v1/billing/subscription` - Current subscription
- `GET /v1/billing/entitlements` - Current quotas

### Tickets
- `POST /v1/tickets` - Create ticket
- `GET /v1/tickets` - List tickets
- `GET /v1/tickets/:id` - Ticket details
- `POST /v1/tickets/:id/messages` - Add message

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `HMAC_SECRET` | Secret for event ingestion verification |
| `STRIPE_SECRET_KEY` | Stripe API key (optional) |

## Next Steps

1. Configure Make.com to POST to `/v1/events/ingest`
2. Set up Stripe for billing
3. Configure Azure Blob for ticket attachments

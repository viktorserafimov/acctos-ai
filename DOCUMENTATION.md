# Acctos AI - Project Documentation

## 1. Project Overview

Acctos AI is a secure, multi-tenant web dashboard designed for customers to manage their document processing usage, billing, and support tickets. The application allows users to view their API usage statistics (ingested from platforms like Make.com), manage their subscriptions via Stripe, and communicate with support agents through a ticketing system.

## 2. Technology Stack

### Frontend (`apps/web`)
*   **Framework**: React (via Vite)
*   **Language**: TypeScript
*   **Styling**: CSS Modules / Vanilla CSS (with responsive design variables)
*   **State Management**: React Context (`AuthContext`)
*   **Routing**: `react-router-dom`
*   **HTTP Client**: `axios`

### Backend (`apps/api`)
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Language**: TypeScript
*   **Database ORM**: Prisma
*   **Authentication**: JSON Web Tokens (JWT)
*   **Validation**: Zod

### Database & Infrastructure
*   **Database**: PostgreSQL
*   **Containerization**: Docker (for local database)
*   **Package Management**: npm (Workspaces)

## 3. Architecture Overview

 The project follows a **Monorepo** structure managed by npm workspaces, allowing for shared configurations and types between the frontend and backend.

```
acctos-ai/
├── apps/
│   ├── api/           # Backend API Service
│   └── web/           # Frontend React Application
├── packages/
│   └── types/         # Shared TypeScript definitions
└── docker-compose.yml # PostgreSQL container configuration
```

### High-Level Data Flow

1.  **User Interaction**: Users interact with the React frontend.
2.  **API Requests**: The frontend sends HTTP requests to the Express API (e.g., `/api/auth`, `/v1/usage`).
3.  **Authentication**: Requests are secured via JWT. The `auth` middleware verifies the token and injects user context.
4.  **Business Logic**: Controllers in `apps/api/src/routes` handle the request logic.
5.  **Data Access**: Prisma Client (`apps/api/src/prisma`) interacts with the PostgreSQL database.

## 4. Key Components & Functionalities

### 4.1. Multi-Tenancy
The application is built from the ground up to support multiple tenants (organizations).
*   **Data Isolation**: All major resources (`UsageEvent`, `Ticket`, `Subscription`) are scoped to a `Tenant` via `tenantId`.
*   **Membership**: Users are linked to Tenants through `Membership` records, which also define their `Role` (e.g., `ADMIN`, `MEMBER`).
*   **Context Switching**: Users can belong to multiple tenants. The active tenant is stored in the JWT payload or requested via the `switch-tenant` endpoint.

### 4.2. Authentication Implemenation
*   **Registration**: Creates a new User and a new Tenant simultaneously.
*   **Login**: Validates credentials and issues a JWT containing `userId` and the default `tenantId`.
*   **Middleware**:
    *   `authenticateToken`: Verifies the JWT signature and attaches `req.user`.
    *   `requireRole`: Checks if the user has the required role within the active tenant.
*   **Frontend**: `AuthContext` manages the token in `localStorage` and handles login/logout/switch-tenant actions.

### 4.3. Usage Tracking (Event Ingestion)
The core value proposition is tracking API usage.
*   **Ingestion Endpoint**: `POST /v1/events/ingest`
    *   Accepts usage events (e.g., "document processed").
    *   Secured via HMAC signature to allow third-party integrations (like Make.com) to push data securely.
*   **Storage**: Events are stored in the `UsageEvent` table.
*   **Aggregation**: A `UsageAggregate` table likely stores daily summaries to speed up dashboard queries (e.g., total tokens, total cost per day).

### 4.4. Billing
*   **Stripe Integration**: The system is designed to sync with Stripe.
*   **Models**:
    *   `Subscription`: Tracks the tenant's current plan status (`trialing`, `active`, etc.).
    *   `Plan`: Defines limits (documents/month, storage) and pricing.

### 4.5. Support Tickets
*   **Functionality**: Users can create support tickets.
*   **Features**:
    *   Internal vs. Public messages.
    *   File attachments (stored as blob URLs).
    *   Priority and Status tracking.

## 5. Database Design (Prisma Schema)

The database schema (`apps/api/prisma/schema.prisma`) is central to the architecture. Key models include:

*   **Tenant**: Represents an organization/workspace.
*   **User**: Represents a global user account.
*   **Membership**: Join table for User-Tenant (Many-to-Many).
*   **UsageEvent**: Raw implementation data.
*   **UsageAggregate**: Pre-calculated stats for performance.
*   **Subscription**: Billing state.

## 6. Detailed API Reference

### Authentication (`/api/auth`)
*   `POST /register`: Register new user and tenant.
*   `POST /login`: Authenticate and get token.
*   `GET /me`: Get current user profile and available tenants.
*   `POST /switch-tenant`: Get a new token scoped to a different tenant.

### Usage (`/v1/usage` & `/v1/events`)
*   `POST /events/ingest`: Ingest a new usage event (Server-to-Server).
*   `GET /usage/summary`: Get usage stats for the dashboard.
*   `GET /usage/timeseries`: Get data for charts.

### Tickets (`/v1/tickets`)
*   `GET /`: List tickets for the current tenant.
*   `POST /`: Create a new ticket.
*   `POST /:id/messages`: Add a reply to a ticket.

## 7. Setup & Development Flow

1.  **Prerequisites**: Node.js 18+, Docker.
2.  **Environment Setup**:
    *   Copy `.env.example` to `.env` in `apps/api`.
    *   Configure `JWT_SECRET` and `DATABASE_URL`.
3.  **Start Database**:
    ```bash
    docker-compose up -d
    ```
4.  **Initialize Schema**:
    ```bash
    npm run db:push
    ```
5.  **Run Application**:
    ```bash
    npm run dev
    ```
    This starts both the API (port 5000) and Web (port 5173) concurrently.

// User and Auth types
export interface User {
    id: string;
    email: string;
    name?: string;
}

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    role: Role;
}

export type Role =
    | 'ORG_OWNER'
    | 'ADMIN'
    | 'BILLING_ADMIN'
    | 'MEMBER'
    | 'READONLY'
    | 'SUPPORT_AGENT';

export interface AuthState {
    user: User | null;
    tenants: Tenant[];
    activeTenantId: string | null;
    token: string | null;
}

// Usage types
export interface UsageEvent {
    id: string;
    tenantId: string;
    source: 'make' | 'azure' | 'openai';
    documentType?: 'bank' | 'vat';
    fileType?: 'pdf' | 'excel';
    step?: 'split' | 'ocr' | 'classify' | 'route' | 'finalize';
    chunkStart?: number;
    chunkEnd?: number;
    bankCode?: string;
    cost?: number;
    tokens?: number;
    timestamp: string;
}

export interface UsageSummary {
    period: string;
    from: string;
    to: string;
    summary: Record<string, {
        eventCount: number;
        totalCost: string;
        totalTokens: number;
    }>;
    totals: {
        events: number;
        cost: string;
        currency: string;
    };
}

export interface TimeseriesPoint {
    date: string;
    make: { events: number; cost: number };
    azure: { events: number; cost: number };
    openai: { events: number; cost: number };
    total: { events: number; cost: number };
}

// Billing types
export interface Plan {
    id: string;
    name: string;
    documentsPerMonth: number;
    pagesPerMonth: number;
    storageGb: number;
    supportSla: 'standard' | 'priority' | 'enterprise';
    priceMonthly: number;
}

export interface Subscription {
    id: string;
    tenantId: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled';
    currentPeriodEnd?: string;
}

export interface Entitlements {
    documentsPerMonth: number;
    pagesPerMonth: number;
    storageGb: number;
    supportSla: string;
    status: string;
}

// Ticket types
export interface Ticket {
    id: string;
    tenantId: string;
    subject: string;
    status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: string;
    updatedAt: string;
    messages?: TicketMessage[];
}

export interface TicketMessage {
    id: string;
    ticketId: string;
    authorId: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    author?: {
        id: string;
        name?: string;
        email: string;
    };
    attachments?: Attachment[];
}

export interface Attachment {
    id: string;
    filename: string;
    blobUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    scanStatus: 'pending' | 'clean' | 'infected';
}

// API Response types
export interface ApiError {
    error: {
        message: string;
        code: string;
    };
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

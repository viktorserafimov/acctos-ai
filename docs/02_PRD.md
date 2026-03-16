# Acctos AI — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 16 March 2026
**Author:** AI Assist BG Product Team
**Status:** Living Document

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users & Personas](#3-target-users--personas)
4. [Problem Statement](#4-problem-statement)
5. [Product Scope](#5-product-scope)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Stories](#8-user-stories)
9. [System Constraints & Dependencies](#9-system-constraints--dependencies)
10. [Release Phases](#10-release-phases)
11. [Success Metrics](#11-success-metrics)
12. [Open Questions & Future Considerations](#12-open-questions--future-considerations)

---

## 1. Executive Summary

Acctos AI is a multi-tenant web application that serves as the primary customer-facing portal for AI Assist BG's document processing automation services. The product enables organisations to monitor how their automated document processing workflows consume resources (PDF pages and Excel rows), manage their subscription plans, purchase additional capacity when needed, and communicate with the support team — all within a single, unified dashboard.

The platform integrates with Make.com (workflow automation), Azure Document Intelligence (OCR/extraction), OpenAI (AI processing), and Stripe (payments) to deliver end-to-end visibility and control over document processing operations.

---

## 2. Product Vision & Goals

### Vision

To be the industry-leading client portal for AI-powered document processing services, giving organisations complete visibility and control over their automated workflows and costs.

### Strategic Goals

| # | Goal | Measurable Outcome |
|---|------|--------------------|
| G1 | **Self-service transparency** | Reduce support inquiries about usage by 60% within 3 months of launch |
| G2 | **Revenue growth through add-ons** | Enable frictionless one-click add-on purchases, targeting 25% of customers purchasing at least one add-on per quarter |
| G3 | **Operational efficiency** | Eliminate manual usage tracking — all usage monitoring, limit enforcement, and billing fully automated |
| G4 | **Customer retention** | Provide enough value through the dashboard to increase renewal rates by 15% |
| G5 | **Multi-language support** | Serve both English and Bulgarian-speaking clients from day one |

---

## 3. Target Users & Personas

### Persona 1: Organisation Administrator

- **Role**: IT Manager or Operations Lead
- **Goals**: Configure integrations, monitor usage, manage team access
- **Pain points**: Lack of visibility into automated processing costs, manual tracking in spreadsheets
- **Technical skill**: Moderate — comfortable with API keys and dashboard navigation

### Persona 2: Billing Manager

- **Role**: Finance or Procurement
- **Goals**: Track costs, manage subscription, purchase add-ons, review invoices
- **Pain points**: Surprise overages, difficulty understanding usage patterns
- **Technical skill**: Low to moderate

### Persona 3: Team Member

- **Role**: Document processing operator or analyst
- **Goals**: View current usage, understand remaining capacity
- **Pain points**: Uncertainty about when limits will be reached
- **Technical skill**: Low — needs a simple, intuitive UI

### Persona 4: Support Agent (Internal)

- **Role**: AI Assist BG support team member
- **Goals**: Respond to tickets, manage customer issues, adjust usage credits
- **Pain points**: Context-switching between multiple tools
- **Technical skill**: Moderate

---

## 4. Problem Statement

Organisations using AI Assist BG's document processing services currently lack:

1. **Real-time visibility** into how many PDF pages and Excel rows they have consumed in the current billing period.
2. **Automated enforcement** — when usage limits are reached, workflows continue running and generate unexpected overages.
3. **Self-service purchasing** — customers cannot buy additional capacity without contacting sales.
4. **Centralised communication** — support requests are scattered across email, phone, and messaging.
5. **Multi-tenant management** — organisations with multiple departments have no way to separate and track usage.

**Impact**: These gaps lead to billing disputes, customer dissatisfaction, operational overhead for the support team, and delayed upsell opportunities.

---

## 5. Product Scope

### In Scope (v1.0)

| Area | Features |
|------|----------|
| **Authentication** | Email/password registration and login, JWT sessions, multi-tenant switching |
| **Usage Dashboard** | Real-time PDF page and Excel row tracking, daily/monthly charts, infrastructure cost breakdown (Make.com, Azure, OpenAI) |
| **Billing & Subscriptions** | Three subscription tiers (Starter, Professional, Enterprise), Stripe-integrated payments, add-on purchases |
| **Usage Limits** | Auto-pause Make.com scenarios on limit breach, auto-resume on add-on purchase or period reset |
| **User Management** | Invite users, assign roles (6 roles), change passwords, remove members |
| **Support Tickets** | Create tickets with categories, threaded messages, internal notes, attachment support |
| **Integrations** | Make.com connection/sync, Azure Document Intelligence verification |
| **Internationalisation** | English and Bulgarian |
| **Admin Tools** | Adjust usage credits, simulate add-on purchases, reset usage counters, manually pause/resume scenarios |

### Out of Scope (v1.0)

- Direct document upload / processing through the dashboard
- White-label / custom branding per tenant
- SSO / SAML authentication
- Webhook notifications to customers (Slack, email)
- Public API for programmatic access by customers
- Mobile-native application

---

## 6. Functional Requirements

### FR-1: Authentication & Multi-Tenancy

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Users register with email, password, full name, and organisation name | P0 |
| FR-1.2 | Registration creates a User, Tenant, and Membership (ORG_OWNER) in a single transaction | P0 |
| FR-1.3 | Users authenticate with email/password, receiving a JWT token | P0 |
| FR-1.4 | Users with multiple tenant memberships can switch tenants without re-authenticating | P1 |
| FR-1.5 | All data access is scoped to the active tenant | P0 |

### FR-2: Usage Monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Dashboard displays current-period PDF pages used vs. limit | P0 |
| FR-2.2 | Dashboard displays current-period Excel rows used vs. limit | P0 |
| FR-2.3 | Custom add-on bars always visible, showing 0/0 when no add-on exists | P0 |
| FR-2.4 | Daily usage charts for the past 7 or 30 days | P1 |
| FR-2.5 | Monthly usage history table (persistent across resets) | P1 |
| FR-2.6 | Infrastructure usage breakdown: Make.com credits, Azure cost, OpenAI tokens | P2 |
| FR-2.7 | CSV export of raw usage events | P2 |

### FR-3: Billing & Subscriptions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Display three subscription plans with pricing, features, and upgrade/downgrade paths | P0 |
| FR-3.2 | Redirect to Stripe checkout for plan purchase | P0 |
| FR-3.3 | Display available add-ons (PDF pages, Excel rows) | P0 |
| FR-3.4 | Process add-on purchases via Stripe webhook | P0 |
| FR-3.5 | Add-on credits consumed FIRST before base plan quota | P0 |
| FR-3.6 | Auto-reset add-on credits to 0 when fully exhausted | P0 |
| FR-3.7 | Billing period resets on the 5th of each month | P0 |
| FR-3.8 | Add-on credits expire at period reset | P1 |

### FR-4: Automated Workflow Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Auto-pause all Make.com scenarios when usage limit is exceeded | P0 |
| FR-4.2 | Auto-resume scenarios when add-on purchase or admin action restores capacity | P0 |
| FR-4.3 | Display persistent banner when scenarios are paused | P0 |
| FR-4.4 | Admin can manually pause/resume all scenarios | P1 |
| FR-4.5 | Limit check runs on every usage-status poll (every ~60s) | P0 |

### FR-5: User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Admins can create new users within their tenant | P0 |
| FR-5.2 | Admins can assign roles (ORG_OWNER, ADMIN, BILLING_ADMIN, MEMBER, READONLY, SUPPORT_AGENT) | P0 |
| FR-5.3 | Admins can change any user's password | P1 |
| FR-5.4 | Admins can remove users from the tenant | P0 |
| FR-5.5 | Users page displays user list with email, name, and role | P0 |

### FR-6: Support Tickets

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Users can create tickets with a subject category and optional description | P0 |
| FR-6.2 | Predefined categories: System not working, Files issues, General support, Downgrade/Cancel | P0 |
| FR-6.3 | Threaded message display for ongoing communication | P1 |
| FR-6.4 | Internal messages visible only to support agents | P2 |
| FR-6.5 | File attachments on messages | P2 |

### FR-7: Integration Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Store and test Make.com API key, Organisation ID, and Folder ID | P0 |
| FR-7.2 | Store and test Azure Document Intelligence credentials | P1 |
| FR-7.3 | Sync usage data from Make.com for the past 30 days | P1 |

### FR-8: Admin Tools

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | Adjust (add/remove) PDF pages and Excel rows consumed in the current period | P1 |
| FR-8.2 | Simulate add-on purchases for testing (bypasses Stripe) | P2 |
| FR-8.3 | Reset all usage data and start fresh billing period | P1 |
| FR-8.4 | Reset custom add-on credits to 0 | P2 |
| FR-8.5 | Test payment cards with Stripe test-mode links | P2 |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | **Performance** | Dashboard loads within 2 seconds on standard broadband |
| NFR-2 | **Performance** | Usage-status endpoint responds within 500ms |
| NFR-3 | **Availability** | 99.5% uptime SLA |
| NFR-4 | **Security** | All passwords hashed with bcrypt (10+ rounds) |
| NFR-5 | **Security** | JWT tokens with configurable expiry (default 24h) |
| NFR-6 | **Security** | Complete tenant data isolation — no cross-tenant data leakage |
| NFR-7 | **Security** | HMAC signature verification on external event ingestion |
| NFR-8 | **Data Integrity** | Idempotent event processing — duplicate events silently ignored |
| NFR-9 | **Scalability** | Daily aggregation tables support thousands of tenants without query degradation |
| NFR-10 | **Localisation** | Full English and Bulgarian language support |
| NFR-11 | **Auditability** | All significant actions logged with user, tenant, timestamp, and metadata |

---

## 8. User Stories

### Epic: Usage Monitoring

- **US-1**: As an organisation admin, I want to see how many PDF pages and Excel rows my team has consumed this billing period, so I can plan capacity.
- **US-2**: As a billing manager, I want to see a chart of daily usage trends, so I can predict when we might reach our limit.
- **US-3**: As a team member, I want to see the remaining capacity at a glance, so I know if my next job will succeed.

### Epic: Billing & Add-ons

- **US-4**: As a billing manager, I want to purchase additional PDF pages with a single click, so processing isn't interrupted.
- **US-5**: As an admin, I want to see that add-on credits are consumed before base plan quota, so purchased credits aren't wasted.
- **US-6**: As a billing manager, I want add-on bars to always be visible (showing 0/0 when empty), so I know the option exists.

### Epic: Workflow Automation

- **US-7**: As an admin, I want Make.com scenarios to auto-pause when we exceed our limit, so we don't incur unexpected costs.
- **US-8**: As an admin, I want scenarios to auto-resume when I purchase add-on credits, so processing resumes without manual intervention.
- **US-9**: As a team member, I want to see a clear banner when workflows are paused, so I understand why processing has stopped.

### Epic: User Management

- **US-10**: As an ORG_OWNER, I want to invite team members with appropriate roles, so they have the right level of access.
- **US-11**: As an admin, I want to change a user's password, so I can help team members who are locked out.

### Epic: Support

- **US-12**: As a user, I want to submit a support ticket from within the dashboard, so I don't need to leave the platform.
- **US-13**: As a support agent, I want to see all tickets for a tenant with threaded messages, so I have full context.

---

## 9. System Constraints & Dependencies

### External Dependencies

| Dependency | Purpose | Risk Level |
|------------|---------|------------|
| **Make.com API** (eu2) | Workflow execution, scenario control, usage sync | High — core workflow depends on this |
| **Stripe** | Payment processing, subscription management | High — revenue depends on this |
| **Azure Document Intelligence** | Document OCR and extraction | Medium — indirect dependency |
| **OpenAI** | AI-powered processing and cost tracking | Low — supplementary feature |
| **PostgreSQL** | Primary data store | High — all features depend on this |

### Technical Constraints

- Billing period fixed to 5th of month (non-configurable in v1)
- Make.com API limited to eu2 region
- Maximum 200 scenarios per folder (Make.com API pagination limit)
- Usage-status polling interval fixed at 60 seconds
- Single-region deployment (no multi-region failover in v1)

---

## 10. Release Phases

### Phase 1: Core Platform (Current — v1.0)

- Authentication & multi-tenancy
- Usage monitoring (PDF pages, Excel rows)
- Billing with 3 subscription tiers
- Add-on purchases (Stripe)
- Auto-pause/resume Make.com scenarios
- User management with 6 roles
- Support tickets
- English + Bulgarian localisation
- Admin tools (adjust credits, simulate purchases, reset usage)

### Phase 2: Enhanced Billing (Planned)

- Stripe Customer Portal integration
- Automated invoicing
- Usage-based billing (pay-per-page option)
- Annual subscription discount
- Payment history in dashboard

### Phase 3: Advanced Features (Future)

- SSO / SAML authentication
- Webhook notifications to customers
- Public REST API for programmatic access
- Custom reporting and analytics
- White-label branding per tenant
- Mobile application

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to first value** | < 5 minutes from registration to seeing usage data | Analytics |
| **Add-on purchase conversion** | 25% of tenants purchase at least one add-on per quarter | Stripe data |
| **Support ticket reduction** | 60% reduction in usage/billing inquiries | Ticket categorisation |
| **Dashboard adoption** | 80% of active tenants log in at least weekly | Auth logs |
| **Auto-pause accuracy** | 100% of limit breaches result in scenario pauses within 2 minutes | System logs |
| **Uptime** | 99.5% | Monitoring |

---

## 12. Open Questions & Future Considerations

| # | Question | Status |
|---|----------|--------|
| Q1 | Should billing period be configurable per tenant (e.g., anniversary-based)? | Deferred to Phase 2 |
| Q2 | Should we support per-scenario usage limits in addition to tenant-level? | Under consideration |
| Q3 | How should we handle tenants with multiple Make.com folders? | Currently single folder; needs design review |
| Q4 | Should we add email notifications for approaching/exceeding limits? | Planned for Phase 2 |
| Q5 | Is there demand for a usage API for customer-side integrations? | Planned for Phase 3 |
| Q6 | Should the Starter plan (£249) include a higher base limit than 1,000? | Product review needed |

---

*End of Product Requirements Document*

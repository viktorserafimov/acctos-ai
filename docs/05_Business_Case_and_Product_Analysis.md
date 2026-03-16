# Acctos AI — Business Case & Product Analysis

**Version:** 1.0
**Date:** 16 March 2026
**Prepared by:** AI Assist BG Product Team
**Classification:** Internal / Strategic

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Context](#2-market-context)
3. [Business Problem](#3-business-problem)
4. [Solution Overview](#4-solution-overview)
5. [Revenue Model](#5-revenue-model)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Value Proposition](#7-value-proposition)
8. [Product Analysis](#8-product-analysis)
9. [Financial Projections](#9-financial-projections)
10. [Risk Assessment](#10-risk-assessment)
11. [Go-to-Market Strategy](#11-go-to-market-strategy)
12. [Key Performance Indicators](#12-key-performance-indicators)
13. [Roadmap & Investment Priorities](#13-roadmap--investment-priorities)
14. [Conclusion](#14-conclusion)

---

## 1. Executive Summary

Acctos AI is a customer-facing SaaS dashboard built to serve clients of AI Assist BG's document processing automation services. It addresses a critical gap in the current service delivery: clients have no self-service visibility into their usage, costs, or workflow status. This results in support overhead, billing friction, missed upsell opportunities, and customer churn.

The platform transforms the customer experience from opaque and support-dependent to transparent and self-service, while creating a new revenue channel through in-app add-on purchases. The tiered subscription model (£249–£2,499/month) combined with one-time add-on purchases creates both predictable recurring revenue and transactional upside.

**Investment ask:** Engineering and operational resources to maintain and extend the platform through Phase 2 (enhanced billing) and Phase 3 (advanced features).

**Expected ROI:** 40-60% reduction in support overhead, 25% increase in add-on revenue, and 15% improvement in customer retention within 12 months.

---

## 2. Market Context

### 2.1 Industry Trends

The intelligent document processing (IDP) market is projected to grow from $2.2 billion (2024) to $12.8 billion (2030), driven by:

- **Digital transformation acceleration** — organisations automating manual document workflows
- **AI/ML maturity** — OCR and extraction models becoming production-ready
- **Compliance pressure** — financial services and healthcare requiring automated audit trails
- **Cost reduction imperative** — enterprises seeking to reduce manual data entry costs by 60-80%

### 2.2 Customer Expectations

Modern B2B SaaS customers expect:
- **Self-service dashboards** with real-time usage visibility
- **Transparent billing** with clear consumption-based pricing
- **Automated enforcement** — no surprise overages
- **In-app purchasing** — buy additional capacity without contacting sales

### 2.3 Target Market

AI Assist BG's primary market:
- **Geography:** United Kingdom, Bulgaria, and broader EU
- **Segments:** Financial services (bank statement processing), legal (contract extraction), accounting (invoice processing)
- **Organisation size:** SME to mid-market (10-500 employees)
- **Decision makers:** IT Managers, Operations Leads, Finance Directors

---

## 3. Business Problem

### 3.1 Current State (Before Acctos AI)

| Challenge | Impact |
|-----------|--------|
| **No usage visibility** | Clients don't know how many pages/rows they've consumed until they receive an invoice |
| **No automated enforcement** | Workflows run past limits, generating unexpected overages and billing disputes |
| **Manual limit management** | Support team manually tracks usage and contacts clients when approaching limits |
| **No self-service purchasing** | Adding capacity requires a phone call or email to sales, causing workflow downtime |
| **Scattered support** | Customer issues arrive via email, phone, and messaging with no unified tracking |
| **No audit trail** | No systematic record of who did what, when — compliance risk |
| **Single-language** | Bulgarian-speaking clients struggle with English-only communications |

### 3.2 Cost of Inaction

| Area | Estimated Annual Impact |
|------|------------------------|
| Support staff time on usage inquiries | £18,000 (1 FTE × 30% of time) |
| Revenue leaked from billing disputes | £8,000 (estimated write-offs) |
| Lost upsell opportunities (delayed add-on purchases) | £24,000 (estimated) |
| Customer churn from poor experience | £36,000 (2 customers × avg. £18,000 ARR) |
| **Total estimated annual impact** | **£86,000** |

---

## 4. Solution Overview

Acctos AI addresses every challenge identified in the business problem:

| Challenge | Solution | Feature |
|-----------|----------|---------|
| No usage visibility | Real-time dashboard with progress bars and charts | Dashboard, Billing page |
| No automated enforcement | Auto-pause Make.com scenarios at limit | Usage limit engine |
| Manual limit management | Automated limit checking every 60 seconds | Usage-status polling |
| No self-service purchasing | One-click Stripe add-on purchases | Add-on cards, Stripe webhook |
| Scattered support | In-app ticket system with categories | Support tickets |
| No audit trail | Comprehensive audit logging | AuditLog model |
| Single-language | English + Bulgarian interface | LanguageContext |

### Technical Architecture Highlights

- **Multi-tenant SaaS** — single deployment serves all clients with complete data isolation
- **Event-driven usage tracking** — idempotent ingestion from Make.com with daily aggregation
- **Lazy billing resets** — no cron jobs needed; resets triggered on next client interaction
- **Real-time automation control** — direct Make.com API integration for scenario pause/resume

---

## 5. Revenue Model

### 5.1 Subscription Revenue (Recurring)

| Plan | Monthly Price | Annual Price | Target Market |
|------|-------------|-------------|---------------|
| Starter | £249 | £2,988 | Small teams, low volume |
| Professional | £989 | £11,868 | Core market, moderate volume |
| Enterprise | £2,499 | £29,988 | High-volume operations |

**Average Revenue Per Account (ARPA):** Estimated £989/month (Professional plan most popular)

### 5.2 Add-on Revenue (Transactional)

| Add-on | Price | Expected Frequency |
|--------|-------|-------------------|
| 1,000 PDF Pages | £TBD | 1-2× per month per customer |
| 5,000 PDF Pages | £TBD | 1× per month for high-volume customers |
| 1,000 Excel Rows | £TBD | 1-2× per month per customer |
| 5,000 Excel Rows | £TBD | 1× per month for high-volume customers |

**Key insight:** Add-on revenue is incremental to subscriptions and has near-100% gross margin (no additional infrastructure cost for existing processing capacity).

### 5.3 Revenue Composition Target

- **Year 1:** 85% subscription / 15% add-ons
- **Year 2:** 75% subscription / 25% add-ons (as self-service purchasing matures)
- **Year 3:** 70% subscription / 30% add-ons

---

## 6. Competitive Landscape

### 6.1 Direct Competitors

| Competitor | Strengths | Weaknesses | Acctos AI Advantage |
|-----------|-----------|------------|-------------------|
| **Rossum** | Strong OCR, enterprise focus | No Make.com integration, expensive | Direct Make.com workflow control, lower price point |
| **Docparser** | Easy setup, template-based | Limited automation, no usage dashboard | Full automation control with auto-pause/resume |
| **Parseur** | Good email parsing | Narrow document types, no billing portal | Broader document support, integrated billing |

### 6.2 Indirect Competitors

| Category | Examples | Acctos AI Differentiation |
|----------|---------|--------------------------|
| Generic automation dashboards | Zapier, n8n | Acctos AI is purpose-built for document processing with domain-specific metrics (pages, rows) |
| Usage tracking tools | Datadog, Mixpanel | Acctos AI combines usage tracking with billing, workflow control, and support |
| Billing platforms | Stripe Dashboard, Chargebee | Acctos AI integrates billing with operational workflow control |

### 6.3 Competitive Moat

1. **Make.com deep integration** — direct scenario control (pause/resume) is unique in the market
2. **Domain-specific metrics** — PDF pages and Excel rows as first-class billing units (not generic API calls)
3. **Automated enforcement** — real-time limit checking with automatic workflow control
4. **Bilingual support** — English + Bulgarian from day one (important for regional market)

---

## 7. Value Proposition

### For Customers

> "Know exactly where you stand — see your document processing usage in real-time, buy more capacity with one click, and never be surprised by your bill again."

**Quantified benefits:**
- **Save 2+ hours/week** previously spent asking about usage status
- **Zero workflow downtime** from forgotten limit management (auto-pause prevents overages, add-on purchase auto-resumes)
- **Transparent billing** — no disputes, no surprise invoices

### For AI Assist BG

> "Turn usage management from a support burden into a revenue engine — automated limit enforcement, frictionless upselling, and data-driven customer success."

**Quantified benefits:**
- **-60% support tickets** about usage and billing
- **+25% add-on revenue** from self-service purchasing
- **+15% retention** from improved customer experience
- **Zero manual tracking** — fully automated usage monitoring and enforcement

---

## 8. Product Analysis

### 8.1 SWOT Analysis

| | Positive | Negative |
|--|---------|---------|
| **Internal** | **Strengths:** Deep Make.com integration, automated workflow control, multi-tenant architecture, bilingual support, comprehensive audit logging | **Weaknesses:** Single database region, limited to eu2.make.com, Stripe-only payments, no mobile app, manual Stripe payment link setup for add-ons |
| **External** | **Opportunities:** Expand to more languages, add more automation platforms (Zapier, n8n), usage-based pricing model, white-label for partners, API marketplace | **Threats:** Make.com API changes, Stripe fee increases, competitor vertical integration, customer preference for native Make.com dashboards |

### 8.2 Feature Maturity Assessment

| Feature | Maturity | Notes |
|---------|----------|-------|
| Authentication & multi-tenancy | Production-ready | JWT auth, role-based access, tenant isolation |
| Usage monitoring | Production-ready | Real-time tracking, daily aggregation, monthly history |
| Billing subscriptions | Functional | Stripe payment links work; customer portal placeholder |
| Add-on purchases | Production-ready | Stripe webhook, auto-resume, simulate for testing |
| Auto-pause/resume | Production-ready | Polling-based limit checks every 60s |
| User management | Production-ready | CRUD, 6 roles, password change |
| Support tickets | MVP | Basic create/list; no email notifications yet |
| Integration settings | Functional | Make.com + Azure; test connection works |
| Audit logging | Schema-ready | Model defined; limited UI visibility |

### 8.3 Technical Debt Assessment

| Area | Severity | Description |
|------|----------|-------------|
| Type casting | Low | `(prisma.tenant as any)` used to work around Prisma type generation lag |
| Stripe checkout | Medium | `POST /checkout` and `GET /portal` are placeholder stubs |
| Attachment storage | Medium | `POST /:id/attachments` placeholder — no blob storage configured |
| Default limits migration | Low | One-time migration in `usage-status` upgrading 1000→5000 limits |
| CSS architecture | Low | Vanilla CSS inline in components; no design system |

### 8.4 User Flow Analysis

**Critical Path: "Customer runs out of pages"**

```
1. Customer's documents are being processed (Make.com scenarios running)
2. Usage reaches 5,000/5,000 pages
3. Layout.tsx polls usage-status → detects exceeded limit
4. Server pauses all Make.com scenarios via API
5. Red banner appears: "Your agent has been paused"
6. Customer navigates to Billing page
7. Sees usage at 5,000/5,000, clicks "Purchase 1,000 PDF Pages"
8. Stripe checkout completes → webhook fires → addonPagesLimit += 1,000
9. Next usage-status poll detects 5,000 < 6,000 → scenarios auto-resume
10. Banner disappears, Custom PDF Pages shows 0/1,000
11. Processing resumes, add-on credits consumed first
12. After 1,000 add-on pages consumed → addonPagesLimit resets to 0
13. Custom bar returns to 0/0, base plan bar continues filling
```

**Time from purchase to resume:** ~60-120 seconds (one polling cycle)

---

## 9. Financial Projections

### 9.1 Revenue Scenarios (12-Month Forecast)

**Assumptions:**
- Current client base: 10 active tenants
- Average plan: Professional (£989/mo)
- New client acquisition: 2 per quarter
- Add-on attachment rate: 25% of tenants, 1.5× per month, avg. £150 per purchase

| Quarter | Tenants | Subscription MRR | Add-on Revenue | Total Quarterly |
|---------|---------|-------------------|----------------|----------------|
| Q1 | 10 | £29,670 | £1,125 | £30,795 |
| Q2 | 12 | £35,604 | £1,620 | £37,224 |
| Q3 | 14 | £41,538 | £2,268 | £43,806 |
| Q4 | 16 | £47,472 | £2,880 | £50,352 |
| **Year 1 Total** | | **£154,284** | **£7,893** | **£162,177** |

### 9.2 Cost Savings

| Area | Annual Savings |
|------|---------------|
| Reduced support overhead (usage/billing inquiries) | £18,000 |
| Eliminated manual usage tracking | £6,000 |
| Reduced billing disputes | £8,000 |
| Reduced churn (15% improvement) | £36,000 |
| **Total annual savings** | **£68,000** |

### 9.3 Return on Investment

| Metric | Value |
|--------|-------|
| Platform development investment (estimated) | £80,000 |
| Year 1 incremental revenue (add-ons + reduced churn) | £43,893 |
| Year 1 cost savings | £68,000 |
| **Year 1 total value** | **£111,893** |
| **Payback period** | **~9 months** |

---

## 10. Risk Assessment

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|-----------|
| R1 | **Make.com API changes** break scenario control | Medium | High | Abstract Make.com API calls behind service layer; monitor Make.com changelogs |
| R2 | **Stripe webhook failures** miss payments | Low | High | Implement webhook retry logic; add manual reconciliation tool |
| R3 | **Database performance** degrades with usage growth | Low | Medium | Daily aggregation tables limit query volume; add indexes as needed |
| R4 | **Customer adopts competitor** with native dashboard | Medium | High | Accelerate Phase 2/3 features; deepen integration value |
| R5 | **Security breach** exposes tenant data | Low | Critical | JWT + tenant isolation + bcrypt; regular security audits; HMAC for external APIs |
| R6 | **Single-region deployment** causes latency for remote clients | Medium | Low | Plan multi-region in Phase 3; CDN for static assets |
| R7 | **Add-on pricing** not yet finalised | High | Medium | A/B test pricing; monitor conversion rates from day one |

---

## 11. Go-to-Market Strategy

### 11.1 Launch Strategy

**Phase 1: Existing Client Migration**
1. Invite all existing AI Assist BG clients to create accounts
2. Pre-configure their tenant settings and Make.com integrations
3. Run guided onboarding sessions (1:1)
4. Collect feedback for rapid iteration

**Phase 2: New Client Acquisition**
1. Include Acctos AI dashboard access as part of all new service agreements
2. Use the dashboard as a sales differentiator during demos
3. Highlight self-service add-on purchasing as a competitive advantage

**Phase 3: Product-Led Growth**
1. Enable free trial accounts with limited usage
2. Self-service plan upgrades from within the dashboard
3. Referral programme for existing clients

### 11.2 Pricing Strategy

- **Starter (£249/mo):** Entry-level for small operations or proof-of-concept
- **Professional (£989/mo):** Core offering for established clients; 5× the capacity at 4× the price (value positioning)
- **Enterprise (£2,499/mo):** High-volume clients with SLA requirements; 15× the capacity at 10× the price (best value per unit)
- **Add-ons:** Priced to be attractive for occasional bursts but not as economical as upgrading (incentivise plan upgrades)

---

## 12. Key Performance Indicators

### Product KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Daily Active Tenants** | 80% of paying tenants | Auth logs |
| **Add-on purchase rate** | 25% of tenants per month | Stripe transactions |
| **Mean time to resume (after pause)** | < 5 minutes | System logs |
| **Support ticket volume (usage/billing)** | -60% within 3 months | Ticket categorisation |
| **Customer NPS** | > 50 | Quarterly survey |

### Technical KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| **API response time (p95)** | < 500ms | Server logs |
| **Dashboard load time** | < 2 seconds | Lighthouse |
| **Usage-status accuracy** | 100% (no missed limit breaches) | Usage-status vs. Make.com state |
| **Webhook processing time** | < 5 seconds from Stripe event to credit | Stripe → server logs |
| **Uptime** | 99.5% | Monitoring |

### Business KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Monthly Recurring Revenue** | £15,000+ by end of Year 1 | Stripe |
| **Net Revenue Retention** | > 110% (expansion through add-ons and upgrades) | Revenue analytics |
| **Customer Acquisition Cost** | < £2,000 | Sales + marketing spend / new customers |
| **Payback Period** | < 12 months | Financial tracking |

---

## 13. Roadmap & Investment Priorities

### Near-Term (Q2 2026)

| Priority | Feature | Business Impact |
|----------|---------|----------------|
| P0 | Finalise add-on pricing and launch | Direct revenue generation |
| P0 | Stripe Customer Portal integration | Self-service invoice access, reduces support |
| P1 | Email notifications (approaching limit, limit reached) | Proactive customer communication |
| P1 | Enhanced ticket system (email replies, status notifications) | Improved support experience |

### Mid-Term (Q3-Q4 2026)

| Priority | Feature | Business Impact |
|----------|---------|----------------|
| P1 | Usage-based billing option (pay-per-page) | New pricing model for variable-volume clients |
| P1 | Annual subscription discount | Improve cash flow and retention |
| P2 | Public API for programmatic access | Developer-friendly, attracts technical clients |
| P2 | Webhook notifications (Slack, email) | Real-time alerts without dashboard login |

### Long-Term (2027)

| Priority | Feature | Business Impact |
|----------|---------|----------------|
| P2 | SSO / SAML authentication | Enterprise requirement |
| P2 | White-label branding | Partner channel enablement |
| P3 | Multi-region deployment | Improved performance for global clients |
| P3 | Mobile application | On-the-go monitoring |

---

## 14. Conclusion

Acctos AI transforms AI Assist BG's service delivery from an opaque, support-heavy model to a transparent, self-service platform. The business case is compelling:

- **Revenue upside:** New add-on revenue stream with near-100% margin
- **Cost savings:** £68,000 annual savings from reduced support and churn
- **Customer experience:** Real-time visibility, one-click purchasing, automated workflow control
- **Competitive advantage:** Deep Make.com integration with automated pause/resume is unique in the market
- **Payback:** ~9 months to recover development investment

The platform is production-ready for its core features and has a clear roadmap for expansion. The recommendation is to proceed with Phase 2 development immediately, focusing on Stripe Customer Portal, email notifications, and add-on pricing finalisation.

---

*End of Business Case & Product Analysis*

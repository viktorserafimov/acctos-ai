# Acctos AI — Client-Facing Functional Documentation

**Version:** 1.0
**Date:** 16 March 2026
**Audience:** Customers of AI Assist BG

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard — Usage Monitoring](#3-dashboard--usage-monitoring)
4. [Billing & Subscriptions](#4-billing--subscriptions)
5. [Add-on Purchases](#5-add-on-purchases)
6. [Usage Limits & Automated Workflow Control](#6-usage-limits--automated-workflow-control)
7. [User Management](#7-user-management)
8. [Support Tickets](#8-support-tickets)
9. [Integration Settings](#9-integration-settings)
10. [Billing Period & Resets](#10-billing-period--resets)
11. [Language Support](#11-language-support)
12. [Frequently Asked Questions](#12-frequently-asked-questions)

---

## 1. Introduction

The Acctos AI Dashboard is your central portal for managing AI Assist BG's document processing services. Through this platform, you can:

- **Monitor** how many PDF pages and Excel rows your organisation has consumed
- **Manage** your subscription plan and purchase additional capacity
- **Control** your automated processing workflows
- **Communicate** with our support team directly from the dashboard
- **Manage** team members and their access levels

This document describes each feature in detail and explains how the system works.

---

## 2. Getting Started

### 2.1 Creating an Account

1. Navigate to the Acctos AI login page.
2. Click **"Create one now"** to switch to the registration form.
3. Enter your **full name**, **organisation name**, **email address**, and a **password**.
4. Click **"Create Account"**.
5. Upon successful registration, you will be redirected to the login form. Sign in with your new credentials.

When you register, the system automatically:
- Creates your personal user account
- Creates your organisation (tenant)
- Assigns you the **Organisation Owner** role with full administrative access

### 2.2 Logging In

1. Enter your email address and password on the login page.
2. Click **"Sign In"**.
3. You will be redirected to the Usage Dashboard.

### 2.3 Switching Organisations

If your account is a member of multiple organisations, you can switch between them using the organisation selector in the top navigation bar. Selecting a different organisation will immediately update all data displayed in the dashboard.

---

## 3. Dashboard — Usage Monitoring

The Dashboard is the primary view after logging in. It is divided into two main sections:

### 3.1 Document Usage

This section displays your current billing period consumption:

- **PDF Pages Spent** — the number of PDF pages processed by your automated workflows since the start of the current billing period.
- **Excel Rows Used** — the number of Excel rows extracted since the start of the current billing period.

Each metric includes:
- A progress bar showing consumption relative to your plan limit
- A numerical display (e.g., "508 / 5,000")

**Custom Add-on Bars**: Below the base plan bars, you will see separate progress bars for any purchased add-on capacity:
- **Custom PDF Pages** — displays 0/0 when no add-on is active, updates to show purchased capacity (e.g., 0/1,000)
- **Custom Excel Rows** — same behaviour for row add-ons

### 3.2 Infrastructure Usage (Administrator Only)

Administrators can view a breakdown of costs across all integrated services:
- **Make.com** — workflow execution credits consumed
- **Azure** — Document Intelligence API costs
- **OpenAI** — AI processing token costs

This section includes time-series charts for visualising usage trends over 7 or 30 days.

### 3.3 Monthly Usage History

A historical table showing PDF pages and Excel rows consumed per calendar month. This data is permanently retained even after billing period resets.

---

## 4. Billing & Subscriptions

### 4.1 Current Period Usage

The Billing page shows your real-time usage status:

| Display | Description |
|---------|-------------|
| **PDF Pages Used** | Current consumption / plan limit (e.g., 508 / 5,000) |
| **Excel Rows Used** | Current consumption / plan limit (e.g., 431 / 5,000) |
| **Custom PDF Pages** | Add-on consumption / add-on limit (e.g., 0 / 1,000) |
| **Custom Excel Rows** | Add-on consumption / add-on limit (e.g., 0 / 0) |
| **Resets on** | Date of next billing period reset |

### 4.2 Subscription Plans

Three subscription tiers are available:

| Plan | Price | PDF Pages/mo | Excel Rows/mo | Features |
|------|-------|-------------|---------------|----------|
| **Starter** | £249/mo | 1,000 | 1,000 | Basic document processing |
| **Professional** | £989/mo | 5,000 | 5,000 | Standard document processing, priority support |
| **Enterprise** | £2,499/mo | 15,000 | 15,000 | Full capacity, enterprise SLA, dedicated support |

To upgrade your plan, click the **"Upgrade to [Plan Name]"** button. You will be redirected to a secure Stripe checkout page.

To downgrade or cancel your subscription, please submit a support ticket through the Support tab.

### 4.3 Add-on Capacity

In addition to your base plan, you can purchase one-time add-on capacity:

| Add-on | Description |
|--------|-------------|
| **1,000 PDF Pages** | Additional PDF page processing capacity |
| **5,000 PDF Pages** | Additional PDF page processing capacity |
| **1,000 Excel Rows** | Additional Excel row processing capacity |
| **5,000 Excel Rows** | Additional Excel row processing capacity |

Add-ons are:
- **One-time payments** — not recurring
- **Consumed first** — your add-on credits are used before your base plan quota
- **Auto-expiring** — unused add-on credits expire at the end of the billing period (5th of month)
- **Auto-resetting** — once fully consumed, the add-on bar resets to 0/0

---

## 5. Add-on Purchases

### 5.1 How Add-on Credits Work

When you purchase add-on capacity (e.g., 1,000 PDF pages):

1. The **Custom PDF Pages** bar updates from 0/0 to 0/1,000.
2. All new document processing usage is consumed against your add-on credits **first**.
3. Only after add-on credits are exhausted does usage count against your base plan quota.
4. When all add-on credits are consumed (e.g., 1,000/1,000), the add-on bar resets to 0/0 automatically.
5. Any further usage then counts against your base plan.

### 5.2 Purchasing Process

1. Navigate to the **Billing** page.
2. Scroll to the **Add-ons** section.
3. Click **"Purchase [add-on name]"**.
4. Complete payment on the secure Stripe checkout page.
5. Credits are added to your account automatically within seconds.
6. If your workflows were paused due to exceeding limits, they will **automatically resume**.

---

## 6. Usage Limits & Automated Workflow Control

### 6.1 How Limits Work

Your total capacity in each billing period is:

```
Total PDF Pages = Base Plan Limit + Add-on Pages
Total Excel Rows = Base Plan Limit + Add-on Rows
```

For example, a Professional plan (5,000 pages) with a 1,000-page add-on gives you 6,000 total pages.

### 6.2 What Happens When You Reach Your Limit

When your usage reaches or exceeds your total limit:

1. All Make.com document processing scenarios are **automatically paused**.
2. A **red notification banner** appears at the top of the dashboard:
   > "You've reached your current usage limit, and your agent has been temporarily paused."
3. No further documents will be processed until capacity is restored.

### 6.3 How to Restore Capacity

You can restore processing in three ways:

| Option | Action | Effect |
|--------|--------|--------|
| **Purchase add-on** | Buy additional pages or rows | Scenarios auto-resume immediately |
| **Upgrade plan** | Move to a higher subscription tier | Higher base limit takes effect |
| **Wait for reset** | Billing period resets on the 5th of month | Usage counters reset to 0, scenarios auto-resume |

### 6.4 Automatic Resume

When your capacity is restored (through add-on purchase or period reset), the system:
1. Detects that current usage is now below the new total limit
2. Automatically starts all paused Make.com scenarios
3. Removes the notification banner from the dashboard
4. No manual action is required

---

## 7. User Management

### 7.1 Team Members

Administrators can manage team members from the **Users** page:

- **View** the list of all team members with their names, emails, and roles
- **Add** new users by clicking "Create User"
- **Change passwords** by clicking the key icon next to a user
- **Remove** users by clicking the delete icon

### 7.2 Roles and Permissions

| Role | Access Level |
|------|-------------|
| **Organisation Owner** | Full access to all features, including destructive actions |
| **Admin** | Full access to all features |
| **Billing Admin** | Billing and subscription management |
| **Member** | View usage data, create support tickets |
| **Read Only** | View-only access to all pages |
| **Support Agent** | Support ticket management |

### 7.3 Adding a Team Member

1. Navigate to the **Users** page.
2. Click **"Create User"**.
3. Enter the new user's full name, email address, and password.
4. Select an appropriate role.
5. Click **"Create"**.

The new user can immediately log in with the provided credentials.

---

## 8. Support Tickets

### 8.1 Creating a Ticket

1. Navigate to the **Support** page.
2. Select a category that best describes your issue:
   - System not working
   - Files issues (missing files, incorrect data)
   - General support
   - Downgrade/Cancel subscription
3. Optionally add a detailed description.
4. Click **"Submit Request"**.

### 8.2 Tracking Your Tickets

After submission, you will receive a confirmation message. Our support team will review your request and respond as soon as possible. You can view all your submitted tickets and their status on the Support page.

---

## 9. Integration Settings

### 9.1 Make.com Configuration

Administrators can configure the connection to Make.com workflows:

1. Navigate to the **Dashboard** page.
2. Click **"Settings"** to expand the integration panel.
3. Enter your Make.com **API Key**, **Organisation ID**, and optionally a **Folder ID**.
4. Click **"Test Connection"** to verify the credentials.
5. Click **"Save Settings"** to persist.

### 9.2 Azure Document Intelligence

Similarly, Azure credentials can be configured:

1. Enter your Azure **API Key** and **Endpoint URL**.
2. Click **"Test Azure Connection"** to verify.
3. Click **"Save Settings"**.

### 9.3 Usage Sync

Click **"Refresh / Sync"** on the Dashboard to pull the latest usage data from Make.com for the past 30 days. This ensures the dashboard reflects the most current state.

---

## 10. Billing Period & Resets

### 10.1 Billing Cycle

- Your billing period runs from the **5th of each month** to the **4th of the following month**.
- On the reset date, the following occurs:
  - PDF pages and Excel rows usage counters reset to 0
  - Any unused add-on credits expire (reset to 0)
  - If scenarios were paused due to limits, they automatically resume (for active subscribers)

### 10.2 Monthly History

All usage data is preserved in the **Monthly Usage History** table before each reset. This provides a permanent record of your consumption patterns over time.

---

## 11. Language Support

The Acctos AI Dashboard supports two languages:

- **English** (default)
- **Bulgarian**

Switch languages using the **EN / BG** toggle in the top navigation bar. Your language preference is saved automatically.

---

## 12. Frequently Asked Questions

**Q: What happens if I exceed my limit mid-document?**
A: The limit check runs approximately every 60 seconds. If usage exceeds the limit between checks, the currently running job will complete, but no new jobs will be started until capacity is restored.

**Q: Can I stack multiple add-on purchases?**
A: Yes. Each add-on purchase adds to your existing add-on credits. For example, purchasing 1,000 pages twice gives you 2,000 add-on pages.

**Q: Do add-on credits carry over to the next billing period?**
A: No. Unused add-on credits expire when the billing period resets on the 5th of the month.

**Q: How quickly does auto-resume work after purchasing an add-on?**
A: Scenarios typically resume within 1-2 minutes of a successful payment. The system detects the new capacity on the next usage-status poll.

**Q: Can I see which specific documents consumed my pages?**
A: The Dashboard shows daily aggregated usage. For detailed per-document breakdowns, contact our support team.

**Q: What does the "Agent Paused" banner mean?**
A: It means your Make.com document processing workflows have been automatically paused because your organisation has reached its usage limit for the current billing period. Purchase add-on capacity or wait for the billing period reset to resume.

**Q: How do I cancel my subscription?**
A: Submit a support ticket through the Support tab with the category "Downgrade/Cancel subscription". Our team will process your request.

---

*End of Client-Facing Functional Documentation*

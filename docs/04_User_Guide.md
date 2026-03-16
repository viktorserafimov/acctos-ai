# Acctos AI — User Guide

**Version:** 1.0
**Date:** 16 March 2026
**Audience:** End users and administrators

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Registration & Login](#2-registration--login)
3. [Navigating the Dashboard](#3-navigating-the-dashboard)
4. [Monitoring Your Usage](#4-monitoring-your-usage)
5. [Managing Your Subscription](#5-managing-your-subscription)
6. [Purchasing Add-on Capacity](#6-purchasing-add-on-capacity)
7. [Understanding Usage Limits](#7-understanding-usage-limits)
8. [Managing Your Team](#8-managing-your-team)
9. [Getting Support](#9-getting-support)
10. [Configuring Integrations](#10-configuring-integrations)
11. [Administrator Tools](#11-administrator-tools)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Welcome

Welcome to the Acctos AI Dashboard, the command centre for your AI-powered document processing. This guide will walk you through every feature step by step.

### What You Can Do

- View your real-time PDF page and Excel row consumption
- Purchase additional processing capacity when needed
- Manage your team's access to the dashboard
- Submit support requests
- Configure your Make.com and Azure integrations

---

## 2. Registration & Login

### Creating Your Account

**Step 1.** Open the Acctos AI Dashboard in your web browser.

**Step 2.** Click **"Create one now"** beneath the login form.

**Step 3.** Fill in the registration form:
- **Your Name** — your full name
- **Organisation Name** — your company or team name
- **Email** — your email address (used for login)
- **Password** — choose a secure password

**Step 4.** Click **"Create Account"**.

**Step 5.** You will see a success message. Switch to the **"Welcome Back"** tab and log in with your email and password.

You are now the **Organisation Owner** with full administrative access.

### Logging In

**Step 1.** Enter your email and password.

**Step 2.** Click **"Sign In"**.

**Step 3.** You will be taken to the Usage Dashboard.

### Switching Organisations

If you belong to multiple organisations:

**Step 1.** Click the organisation name in the top navigation bar.

**Step 2.** Select the organisation you want to view.

**Step 3.** The dashboard updates immediately to show that organisation's data.

---

## 3. Navigating the Dashboard

The main navigation bar on the left side provides access to all sections:

| Icon | Page | What It Does |
|------|------|-------------|
| Chart | **Usage** | Monitor your document processing consumption |
| Card | **Billing** | Manage subscriptions and add-ons |
| Headset | **Support** | Submit and track support tickets |
| People | **Users** | Manage team members (admin only) |

**Top bar features:**
- **Organisation selector** — switch between organisations (if applicable)
- **Language toggle** — switch between English and Bulgarian (EN / BG)
- **Logout button** — sign out of your account

### Pause Notification Banner

If your automated workflows have been paused due to reaching your usage limit, a **red banner** appears at the top of every page:

> "You've reached your current usage limit, and your agent has been temporarily paused."

This banner disappears automatically once capacity is restored.

---

## 4. Monitoring Your Usage

### Viewing Current Usage

Navigate to the **Usage** (Dashboard) page. You will see two main tabs:

**Document Usage tab** shows:
- **PDF Pages Spent** — a progress bar and number (e.g., 508 / 5,000)
- **Excel Rows Used** — a progress bar and number (e.g., 431 / 5,000)
- A daily chart showing usage over the selected time period
- Monthly usage history table

**Infrastructure Usage tab** (admin only) shows:
- Make.com credits consumed
- Azure Document Intelligence costs
- OpenAI token costs and estimated cost in euros

### Changing the Time Range

Above the charts, you can select:
- **Last 7 days** — shows the past week
- **Last 30 days** — shows the past month
- **Custom** — enter a specific number of days (1-30)

Click **"Apply"** after entering a custom value.

### Exporting Data

Click the **"Export"** button to download a CSV file of your raw usage events.

### Syncing Latest Data

Click **"Refresh / Sync"** to pull the most recent usage data from Make.com. This is useful if you want to ensure the dashboard is completely up to date.

---

## 5. Managing Your Subscription

### Viewing Your Current Plan

Navigate to the **Billing** page. At the top, you will see:
- Your current usage for the billing period
- The plan name (e.g., "Professional Plan")
- The next reset date

### Subscription Plans

Scroll down to the **Subscription Plans** section to see available plans:

| Plan | Monthly Price | PDF Pages | Excel Rows |
|------|-------------|-----------|------------|
| Starter | £249 | 1,000 | 1,000 |
| Professional | £989 | 5,000 | 5,000 |
| Enterprise | £2,499 | 15,000 | 15,000 |

Your current plan is highlighted with a **"Current Plan"** badge.

### Upgrading Your Plan

**Step 1.** Find the plan you want to upgrade to.

**Step 2.** Click **"Upgrade to [Plan Name]"**.

**Step 3.** Complete payment on the Stripe checkout page.

**Step 4.** Your new limits take effect immediately.

### Downgrading or Cancelling

To downgrade or cancel your subscription:

**Step 1.** Navigate to the **Support** tab.

**Step 2.** Select **"Downgrade/Cancel subscription"** as the issue type.

**Step 3.** Describe your request and click **"Submit Request"**.

Our team will process your request promptly.

---

## 6. Purchasing Add-on Capacity

Add-ons give you extra capacity on top of your base plan without upgrading.

### How to Purchase

**Step 1.** Navigate to the **Billing** page.

**Step 2.** Scroll to the **Add-ons** section.

**Step 3.** Choose your add-on:
- 1,000 or 5,000 additional PDF Pages
- 1,000 or 5,000 additional Excel Rows

**Step 4.** Click **"Purchase [add-on name]"**.

**Step 5.** Complete payment on the Stripe checkout page.

**Step 6.** Your add-on credits appear immediately on the billing page.

### Understanding Add-on Bars

On the Billing page, you will always see four progress bars:

1. **PDF Pages Used** — your base plan consumption (e.g., 508 / 5,000)
2. **Custom PDF Pages** — your add-on consumption (e.g., 0 / 0 or 200 / 1,000)
3. **Excel Rows Used** — your base plan consumption
4. **Custom Excel Rows** — your add-on consumption

**Before purchasing an add-on:**
```
Custom PDF Pages:    0 / 0
```

**After purchasing 1,000 pages:**
```
Custom PDF Pages:    0 / 1,000
```

**After consuming 600 of your add-on pages:**
```
Custom PDF Pages:    600 / 1,000
```

**After consuming all 1,000 add-on pages (auto-reset):**
```
Custom PDF Pages:    0 / 0
```

### Key Facts About Add-ons

- Add-on credits are consumed **before** your base plan quota
- Multiple purchases stack (buying 1,000 twice = 2,000 total)
- Unused credits **expire** at the end of the billing period
- When fully consumed, add-on bars reset to 0/0 automatically
- If your workflows were paused, they **resume automatically** after purchase

---

## 7. Understanding Usage Limits

### Your Total Capacity

```
Total Pages = Base Plan Pages + Add-on Pages
Total Rows  = Base Plan Rows  + Add-on Rows
```

**Example:**
- Professional plan: 5,000 pages, 5,000 rows
- Add-on purchase: 1,000 pages
- **Total: 6,000 pages, 5,000 rows**

### When You Reach Your Limit

1. Your Make.com processing workflows **pause automatically**
2. A **red banner** appears across the dashboard
3. No new documents will be processed
4. Documents currently being processed will complete

### Restoring Capacity

| Method | How | Time to Resume |
|--------|-----|---------------|
| Purchase add-on | Buy pages or rows on the Billing page | 1-2 minutes |
| Upgrade plan | Upgrade to a higher tier | Immediate |
| Wait for reset | Billing period resets on the 5th of each month | Automatic on reset date |

### Billing Period

- Runs from the **5th of each month** to the **4th of the next month**
- On reset day: usage counters go to 0, add-on credits expire, paused workflows resume
- Monthly history is preserved permanently in the history table

---

## 8. Managing Your Team

*Requires Administrator or Organisation Owner role.*

### Viewing Team Members

Navigate to the **Users** page to see all members of your organisation, including their name, email, and role.

### Adding a Team Member

**Step 1.** Click **"Create User"** in the top right.

**Step 2.** Fill in the form:
- **Full Name** — the user's display name
- **Email** — must be unique across the platform
- **Password** — minimum 8 characters
- **Role** — select the appropriate access level

**Step 3.** Click **"Create"**.

The user can now log in immediately.

### Changing a User's Password

**Step 1.** Find the user in the list.

**Step 2.** Click the **key icon** (lock) in the actions column.

**Step 3.** Enter the new password in the modal that appears.

**Step 4.** Click **"Save"**.

### Removing a User

**Step 1.** Find the user in the list.

**Step 2.** Click the **delete icon** (trash) in the actions column.

**Step 3.** Confirm the removal in the dialog.

The user will immediately lose access to this organisation. If they belong to other organisations, those are not affected.

### Role Reference

| Role | Can View Usage | Can View Billing | Can Manage Users | Can Adjust Credits |
|------|---------------|-----------------|-----------------|-------------------|
| Organisation Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes |
| Billing Admin | Yes | Yes | No | No |
| Member | Yes | Limited | No | No |
| Read Only | Yes | Yes (view) | No | No |
| Support Agent | Yes | No | No | No |

---

## 9. Getting Support

### Submitting a Support Request

**Step 1.** Navigate to the **Support** page.

**Step 2.** Select the issue category that best matches your problem:
- **System not working** — the document processing system is not functioning
- **Files issues** — missing files, incorrect data extracted, or other data quality problems
- **General support** — any other question or request
- **Downgrade/Cancel subscription** — request to change or cancel your plan

**Step 3.** (Optional) Add a detailed description of your issue.

**Step 4.** Click **"Submit Request"**.

**Step 5.** You will see a confirmation message. Our support team will review your request and respond as soon as possible.

### Following Up

Return to the Support page to view your submitted tickets and any responses from the support team.

---

## 10. Configuring Integrations

*Requires Administrator role.*

### Make.com Setup

**Step 1.** Navigate to the **Usage Dashboard**.

**Step 2.** Click **"Settings"** to expand the integration panel.

**Step 3.** Enter your credentials:
- **API Key** — your Make.com API token
- **Organisation ID** — your Make.com organisation identifier
- **Folder ID** (optional) — filters which scenarios are managed

**Step 4.** Click **"Test Connection"** to verify your credentials work.

**Step 5.** Click **"Save Settings"**.

### Azure Document Intelligence Setup

**Step 1.** In the same settings panel, enter your Azure credentials:
- **API Key** — your Azure Document Intelligence subscription key
- **Endpoint** — your Azure resource endpoint URL

**Step 2.** Click **"Test Azure Connection"**.

**Step 3.** Click **"Save Settings"**.

### Connection Indicators

The dashboard shows connection status indicators:
- **Green checkmark** — connection verified successfully
- **Red warning** — connection failed, check credentials

---

## 11. Administrator Tools

*These features are only visible to Organisation Owners and Admins.*

### Adjusting Usage Credits

On the **Billing** page, the **Adjust Usage** section allows you to manually modify the consumed pages or rows:

**Step 1.** Enter a positive number to add usage, or a negative number to remove usage.

**Step 2.** Click **"Apply"** for either PDF Pages or Excel Rows.

**Step 3.** The usage display updates immediately.

This is useful for correcting erroneous usage data or crediting back processing that failed.

### Simulating Add-on Purchases (Testing)

In the **Test Payments** section, you can:
- Click **"+ Credit 1,000 rows"** or **"+ Credit 1,000 pages"** to instantly add add-on credits without going through Stripe
- Use Stripe test-mode payment links to test the full payment flow

### Resetting Usage

The **"Reset Pages & Rows"** button on the Dashboard:
1. Snapshots current monthly data to permanent history
2. Deletes all usage events and aggregates
3. Resets counters to 0
4. Resumes any paused Make.com scenarios

**Warning:** This action is permanent and cannot be undone.

### Resetting Custom Credits

The **"Reset Custom Credits to 0"** button clears add-on credits without affecting base plan usage.

### Pausing / Resuming Scenarios

The **"Pause Scenarios"** and **"Resume Scenarios"** buttons on the Dashboard allow manual control over Make.com workflows independent of usage limits.

---

## 12. Troubleshooting

### "Agent Paused" Banner Won't Go Away

**Cause:** Your usage has reached the total limit (base plan + add-ons).

**Solution:** Purchase add-on capacity or wait for the billing period reset. The banner disappears automatically within 1-2 minutes of restoring capacity.

### Usage Numbers Don't Look Right

**Cause:** Data may not have synced from Make.com yet.

**Solution:**
1. Click **"Refresh / Sync"** on the Dashboard
2. Wait 30-60 seconds for the data to update

### Can't Access the Users Page

**Cause:** Your account does not have Administrator privileges.

**Solution:** Ask your Organisation Owner to upgrade your role.

### Make.com Connection Test Fails

**Possible causes:**
- API key is incorrect or expired
- Organisation ID doesn't match your Make.com account
- Make.com is experiencing service issues

**Solution:** Verify your API key in the Make.com dashboard, ensure the Organisation ID is correct, and try again.

### Purchased Add-on but Scenarios Didn't Resume

**Cause:** The auto-resume check runs on the next usage-status poll (up to 60 seconds).

**Solution:** Wait 1-2 minutes. If scenarios still haven't resumed, click **"Resume Scenarios"** manually on the Dashboard (admin only).

### Can't Find the Billing Page

**Cause:** Your role may not have billing access.

**Solution:** Contact your Organisation Owner for assistance.

---

*End of User Guide*

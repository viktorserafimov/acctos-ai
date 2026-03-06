import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CreditCard, Check, AlertCircle, ExternalLink } from 'lucide-react';

const PdfIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#ef4444"/>
        <polyline points="14,2 14,8 20,8" fill="#fca5a5" stroke="#fca5a5" strokeWidth="0.5"/>
        <text x="5.5" y="17" fontSize="5.5" fill="white" fontWeight="bold" fontFamily="sans-serif">PDF</text>
    </svg>
);

const ExcelIcon = ({ size = 16 }: { size?: number }) => (
    <img src="/excel_logo.png" alt="Excel" width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />
);

// ── Hardcoded plan definitions ────────────────────────────────────────────────
const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        priceLabel: '£249',
        stripeLink: 'https://buy.stripe.com/7sYdRa2dM25YfqydQgaZi0h',
        tier: 1,
        pagesPerMonth: 1000,
        rowsPerMonth: 1000,
        features: ['1,000 PDF pages / month', '1,000 Excel rows / month'],
    },
    {
        id: 'professional',
        name: 'Professional',
        priceLabel: '£989',
        stripeLink: 'https://buy.stripe.com/3cI4gA2dM4e60vE4fGaZi0j',
        tier: 2,
        pagesPerMonth: 5000,
        rowsPerMonth: 5000,
        highlighted: true,
        features: ['5,000 PDF pages / month', '5,000 Excel rows / month'],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        priceLabel: '£2,249',
        stripeLink: 'https://buy.stripe.com/aFabJ22dM8umdiqcMcaZi0i',
        tier: 3,
        pagesPerMonth: 15000,
        rowsPerMonth: 15000,
        features: ['15,000 PDF pages / month', '15,000 Excel rows / month'],
    },
];

const ADD_ONS = [
    {
        id: 'custom_pages',
        name: 'Custom PDF Pages',
        description: 'Additional PDF page processing capacity',
        addonType: 'pages',
        options: [
            { qty: 1000,  label: '1,000 PDF pages',  price: '£249',   stripeLink: 'https://buy.stripe.com/8x200kg4CbGya6efYoaZi0l' },
            { qty: 2000,  label: '2,000 PDF pages',  price: '£498',   stripeLink: 'https://buy.stripe.com/5kQcN62dMaCu5PYfYoaZi0m' },
            { qty: 5000,  label: '5,000 PDF pages',  price: '£1,245', stripeLink: 'https://buy.stripe.com/00w4gA6u29yqguCbI8aZi0n' },
        ],
    },
    {
        id: 'custom_rows',
        name: 'Custom Excel Rows',
        description: 'Additional Excel row processing capacity',
        addonType: 'rows',
        options: [
            { qty: 1000,  label: '1,000 Excel rows',  price: '£50',  stripeLink: 'https://buy.stripe.com/9B65kE4lUaCu0vE9A0aZi0k' },
            { qty: 2000,  label: '2,000 Excel rows',  price: '£100', stripeLink: 'https://buy.stripe.com/fZu28s6u26mecem6nOaZi0o' },
            { qty: 5000,  label: '5,000 Excel rows',  price: '£250', stripeLink: 'https://buy.stripe.com/aFafZiaKi4e6cem9A0aZi0p' },
        ],
    },
];

// Map Stripe Price IDs → plan tier (fill in once Stripe webhooks are live)
// e.g.  'price_xxxxx': 1,  'price_yyyyy': 2,  'price_zzzzz': 3
const PRICE_ID_TO_TIER: Record<string, number> = {};

interface UsageStatus {
    currentPages: number;
    currentRows: number;
    pagesLimit: number;
    rowsLimit: number;
    addonPagesLimit: number;
    addonRowsLimit: number;
    addonPagesUsed: number;
    addonRowsUsed: number;
    totalPagesLimit: number;
    totalRowsLimit: number;
    scenariosPaused: boolean;
    lastResetAt: string;
    nextResetAt: string;
    subscriptionStatus: string;
}

export default function Billing() {
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [rawUsage, setRawUsage] = useState<{ pages: number; rows: number } | null>(null);
    const [currentTier, setCurrentTier] = useState(2); // Default: Professional plan
    const [loading, setLoading] = useState(true);
    const [addonSelection, setAddonSelection] = useState<Record<string, number>>({ custom_pages: 0, custom_rows: 0 });

    const fetchData = useCallback(async () => {
        try {
            const [statusRes, rawRes, subRes] = await Promise.allSettled([
                axios.get('/v1/billing/usage-status'),
                axios.get('/v1/billing/raw-usage'),
                axios.get('/v1/billing/subscription'),
            ]);

            if (statusRes.status === 'fulfilled') {
                setUsageStatus(statusRes.value.data);
            }

            if (rawRes.status === 'fulfilled') {
                setRawUsage(rawRes.value.data);
            }

            if (subRes.status === 'fulfilled') {
                const sub = subRes.value.data;
                if (sub?.status === 'active') {
                    setCurrentTier(PRICE_ID_TO_TIER[sub.stripePriceId ?? ''] || 1);
                }
            }
        } catch (err) {
            console.error('Failed to load billing data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);


    const isSubscribed = (usageStatus?.subscriptionStatus === 'active') || currentTier > 0;

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    if (loading) {
        return <div className="loading-container"><div className="spinner" /></div>;
    }

    const us = usageStatus;
    const pagesLimit  = us?.pagesLimit  ?? 5000;
    const rowsLimit   = us?.rowsLimit   ?? 5000;
    const addonPages  = us?.addonPagesLimit ?? 0;
    const addonRows   = us?.addonRowsLimit  ?? 0;
    // Prefer billing-period usage from usage-status — this is the same window
    // the auto-pause logic uses, so the bar turns red exactly when limits trip.
    // Fall back to raw 30-day usage only when usage-status is unavailable.
    const curPages    = us?.currentPages ?? rawUsage?.pages ?? 0;
    const curRows     = us?.currentRows  ?? rawUsage?.rows  ?? 0;
    const addonPagesUsed = us?.addonPagesUsed ?? 0;
    const addonRowsUsed  = us?.addonRowsUsed  ?? 0;
    const isPaused    = us?.scenariosPaused ?? false;

    const pagesPct = Math.min(100, pagesLimit > 0 ? (Math.min(curPages, pagesLimit) / pagesLimit) * 100 : 0);
    const rowsPct  = Math.min(100, rowsLimit  > 0 ? (Math.min(curRows,  rowsLimit)  / rowsLimit)  * 100 : 0);
    const addonPagesPct = Math.min(100, addonPages > 0 ? (addonPagesUsed / addonPages) * 100 : 0);
    const addonRowsPct  = Math.min(100, addonRows  > 0 ? (addonRowsUsed  / addonRows)  * 100 : 0);

    return (
        <div>
            {/* Paused scenarios banner */}
            {isPaused && (
                <div className="pause-banner">
                    <AlertCircle size={20} />
                    <div className="pause-banner-text">
                        <strong>Your Agent has been paused</strong> — you have reached your usage limit
                        for this billing period.
                        {isSubscribed
                            ? ` Your scenarios will auto-resume on ${us?.nextResetAt ? formatDate(us.nextResetAt) : 'the 5th of next month'} when the new period starts.`
                            : ' Purchase additional pages or rows below to resume, or upgrade your subscription.'
                        }
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="billing-header">
                <div>
                    <h2>Billing & Subscription</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Manage your subscription and monitor usage limits
                    </p>
                </div>
            </div>

            {/* Current usage card */}
            <div className="current-plan-card">
                <div className="current-plan-header">
                    <div>
                        <h3>Current Period Usage</h3>
                        <div className="status-badge" data-status="active">
                            Professional Plan
                        </div>
                        {us?.nextResetAt && (
                            <p className="reset-note">
                                Resets on {formatDate(us.nextResetAt)}
                            </p>
                        )}
                    </div>
                    <CreditCard size={32} color="var(--primary)" />
                </div>

                <div className="quota-grid">
                    {/* Base pages */}
                    <div className="quota-item">
                        <div className="quota-item-header">
                            <span className="quota-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PdfIcon size={15} /> PDF Pages Used</span>
                            <span className="quota-value">
                                {curPages.toLocaleString()} / {pagesLimit.toLocaleString()}
                            </span>
                        </div>
                        <div className="quota-bar">
                            <div className="quota-fill" style={{ width: `${pagesPct}%`, background: pagesPct >= 100 ? '#ef4444' : undefined }} />
                        </div>
                    </div>

                    {/* Base rows */}
                    <div className="quota-item">
                        <div className="quota-item-header">
                            <span className="quota-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ExcelIcon size={15} /> Excel Rows Used</span>
                            <span className="quota-value">
                                {curRows.toLocaleString()} / {rowsLimit.toLocaleString()}
                            </span>
                        </div>
                        <div className="quota-bar">
                            <div className="quota-fill" style={{ width: `${rowsPct}%`, background: rowsPct >= 100 ? '#ef4444' : undefined }} />
                        </div>
                    </div>
                </div>

                {/* Add-on trackers — only shown when add-ons have been purchased */}
                {addonPages > 0 && (
                    <div className="addon-tracker">
                        <div className="addon-tracker-label">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PdfIcon size={13} /> Extra PDF Pages (add-on)</span>
                            <span>{addonPagesUsed.toLocaleString()} / {addonPages.toLocaleString()}</span>
                        </div>
                        <div className="quota-bar">
                            <div
                                className="quota-fill addon-fill"
                                style={{ width: `${addonPagesPct}%`, background: addonPagesPct >= 100 ? '#ef4444' : undefined }}
                            />
                        </div>
                    </div>
                )}
                {addonRows > 0 && (
                    <div className="addon-tracker">
                        <div className="addon-tracker-label">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ExcelIcon size={13} /> Extra Excel Rows (add-on)</span>
                            <span>{addonRowsUsed.toLocaleString()} / {addonRows.toLocaleString()}</span>
                        </div>
                        <div className="quota-bar">
                            <div
                                className="addon-fill quota-fill"
                                style={{ width: `${addonRowsPct}%`, background: addonRowsPct >= 100 ? '#ef4444' : undefined }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Plans */}
            <h3 style={{ marginBottom: '1.5rem' }}>Subscription Plans</h3>
            <div className="plans-grid">
                {PLANS.map((plan) => {
                    const isCurrentPlan = isSubscribed && plan.tier === currentTier;
                    const isLowerTier   = isSubscribed && plan.tier < currentTier;

                    return (
                        <div
                            key={plan.id}
                            className={`plan-card${plan.highlighted ? ' plan-card--highlighted' : ''}${isCurrentPlan ? ' plan-card--current' : ''}`}
                        >
                            {plan.highlighted && !isCurrentPlan && (
                                <div className="plan-badge">Most Popular</div>
                            )}
                            {isCurrentPlan && (
                                <div className="plan-badge plan-badge--current">Current Plan</div>
                            )}

                            <div className="plan-header">
                                <h4>{plan.name}</h4>
                                <div className="plan-price">
                                    <span className="price-amount">{plan.priceLabel}</span>
                                    <span className="price-period">/month</span>
                                </div>
                            </div>

                            <ul className="plan-features">
                                {plan.features.map((f) => (
                                    <li key={f}>
                                        <Check size={16} color="var(--success, #10b981)" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            {isCurrentPlan && (
                                <button disabled className="btn-current-plan">
                                    <Check size={16} />
                                    Currently chosen plan
                                </button>
                            )}
                            {!isCurrentPlan && isLowerTier && (
                                <a
                                    href={plan.stripeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary btn-plan"
                                    onClick={() => setCurrentTier(plan.tier)}
                                >
                                    <ExternalLink size={16} />
                                    Downgrade to {plan.name}
                                </a>
                            )}
                            {!isCurrentPlan && !isLowerTier && (
                                <a
                                    href={plan.stripeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary btn-plan"
                                    onClick={() => setCurrentTier(plan.tier)}
                                >
                                    <ExternalLink size={16} />
                                    {isSubscribed ? `Upgrade to ${plan.name}` : `Subscribe — ${plan.priceLabel}/mo`}
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="downgrade-notice">
                If you want to downgrade or cancel your subscription please submit a ticket through the Support tab.
            </p>

            {/* Add-ons */}
            <h3 style={{ marginBottom: '1.5rem', marginTop: '2.5rem' }}>Add-ons</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '-1rem' }}>
                Purchase additional capacity as a one-time payment for the current billing period. Scenarios are automatically
                resumed after a successful payment (requires Stripe webhook configuration).
            </p>
            <div className="addons-grid">
                {ADD_ONS.map((addon) => {
                    const selIdx = addonSelection[addon.id] ?? 0;
                    const selected = addon.options[selIdx];
                    return (
                        <div key={addon.id} className="addon-card">
                            <div className="addon-card-top">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {addon.addonType === 'pages' ? <PdfIcon size={20} /> : <ExcelIcon size={20} />}
                                    {addon.name}
                                </h4>
                                <p className="addon-description">{addon.description}</p>
                            </div>

                            {/* Pill selector */}
                            <div className="addon-pills">
                                {addon.options.map((opt, idx) => (
                                    <button
                                        key={opt.qty}
                                        className={`addon-pill${selIdx === idx ? ' active' : ''}`}
                                        onClick={() => setAddonSelection(prev => ({ ...prev, [addon.id]: idx }))}
                                    >
                                        <span className="pill-qty">{opt.qty.toLocaleString()}</span>
                                        <span className="pill-price">{opt.price}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Summary row */}
                            <div className="addon-summary">
                                <span className="addon-summary-label">One-time payment</span>
                                <span className="addon-summary-price">{selected.price}</span>
                            </div>

                            {/* Purchase CTA */}
                            <a
                                href={selected.stripeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary addon-purchase-btn"
                            >
                                <ExternalLink size={16} />
                                Purchase {selected.label}
                            </a>
                        </div>
                    );
                })}
            </div>

            <style>{`
        .billing-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .pause-banner {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 1rem;
          color: #ef4444;
          margin-bottom: 1.5rem;
        }
        .pause-banner svg { flex-shrink: 0; margin-top: 2px; }
        .pause-banner-text { flex: 1; line-height: 1.5; font-size: 0.9rem; }
        .pause-banner-text strong { font-size: 1rem; }
        .current-plan-card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          margin-bottom: 2rem;
        }
        .current-plan-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .current-plan-header h3 { margin-bottom: 0.5rem; }
        .reset-note {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 0.4rem;
        }
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-badge[data-status="trialing"] {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
        .status-badge[data-status="active"] {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .quota-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .quota-item { display: flex; flex-direction: column; gap: 0.5rem; }
        .quota-item-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .quota-label { font-size: 0.9rem; color: var(--text-muted); }
        .quota-value { font-size: 1rem; font-weight: 600; }
        .quota-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }
        .quota-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 4px;
          transition: width 0.4s ease;
        }
        .addon-tracker {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .addon-tracker-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .addon-fill {
          background: linear-gradient(90deg, #f59e0b, #ec4899) !important;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 1.25rem;
        }
        @media (max-width: 1000px) {
          .plans-grid { grid-template-columns: 1fr; }
          .quota-grid { grid-template-columns: 1fr; }
          .addons-grid { grid-template-columns: 1fr; }
        }
        .plan-card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .plan-card--highlighted {
          border-color: var(--primary);
          background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.04));
        }
        .plan-card--current {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
        }
        .plan-badge {
          position: absolute;
          top: -0.75rem;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.2rem 0.9rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
          white-space: nowrap;
        }
        .plan-badge--current { background: linear-gradient(135deg, #10b981, #059669); }
        .plan-header { margin-bottom: 1.5rem; margin-top: 0.5rem; }
        .plan-header h4 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        .plan-price { display: flex; align-items: baseline; gap: 0.25rem; }
        .price-amount { font-size: 2rem; font-weight: 700; color: var(--primary); }
        .price-period { color: var(--text-muted); }
        .plan-features { list-style: none; padding: 0; margin: 0 0 1.5rem 0; flex: 1; }
        .plan-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          color: var(--text-muted);
        }
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-plan { width: 100%; margin-top: auto; }
        .btn-current-plan {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid #10b981;
          border-radius: 0.75rem;
          color: #10b981;
          font-weight: 600;
          font-size: 0.9rem;
          margin-top: auto;
          width: 100%;
          cursor: default;
          opacity: 1;
        }
        .btn-secondary.btn-plan {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          text-decoration: none;
          transition: opacity 0.2s;
          margin-top: auto;
        }
        .btn-secondary.btn-plan:hover { opacity: 0.8; }
        .downgrade-notice {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-bottom: 0;
        }
        .addons-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .addon-card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .addon-description { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem; }
        .addon-card-top { margin-bottom: 1.25rem; }
        .addon-card-top h4 { font-size: 1.1rem; }
        .addon-pills {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .addon-pill {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.65rem 0.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-muted);
        }
        .addon-pill:hover { border-color: var(--primary); color: var(--primary); background: rgba(99,102,241,0.06); }
        .addon-pill.active {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.12);
          color: var(--primary);
        }
        .pill-qty { font-size: 0.95rem; font-weight: 700; }
        .pill-price { font-size: 0.75rem; opacity: 0.8; }
        .addon-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 0.75rem;
          margin-bottom: 1rem;
        }
        .addon-summary-label { font-size: 0.85rem; color: var(--text-muted); }
        .addon-summary-price { font-size: 1.4rem; font-weight: 700; color: var(--primary); }
        .addon-purchase-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          text-decoration: none;
        }
      `}</style>
        </div>
    );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CreditCard, Check, AlertCircle, ExternalLink, FlaskConical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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

// Admin-only test payment links (Stripe test mode)
const TEST_PAYMENTS = [
    {
        id: 'test_starter',
        label: 'Starter Plan — Test Subscribe',
        description: 'Simulates a Starter (£249/mo) subscription purchase',
        stripeLink: 'https://buy.stripe.com/test_28EeVd6CF4p07O7cWgcs800',
        type: 'subscription',
    },
    {
        id: 'test_rows_1000',
        label: '1,000 Excel Rows — Test Add-on',
        description: 'Simulates a 1,000 row add-on one-time payment',
        stripeLink: 'https://buy.stripe.com/test_00wbJ19OR7Bc1pJbSccs801',
        type: 'addon',
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
    const { isAdmin } = useAuth();
    const { t } = useLanguage();
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
                        <strong>{t.agentPausedBilling}</strong>{t.agentPausedBillingDesc}
                        {isSubscribed
                            ? t.autoResume(us?.nextResetAt ? formatDate(us.nextResetAt) : '—')
                            : t.purchaseToResume
                        }
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="billing-header">
                <div>
                    <h2>{t.billingTitle}</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        {t.billingSubtitle}
                    </p>
                </div>
            </div>

            {/* Current usage card */}
            <div className="current-plan-card">
                <div className="current-plan-header">
                    <div>
                        <h3>{t.currentPeriodUsage}</h3>
                        <div className="status-badge" data-status="active">
                            {t.professionalPlan}
                        </div>
                        {us?.nextResetAt && (
                            <p className="reset-note">
                                {t.resetsOn(formatDate(us.nextResetAt))}
                            </p>
                        )}
                    </div>
                    <CreditCard size={32} color="var(--primary)" />
                </div>

                <div className="quota-grid">
                    {/* Base pages */}
                    <div className="quota-item">
                        <div className="quota-item-header">
                            <span className="quota-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PdfIcon size={15} /> {t.pdfPagesUsed}</span>
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
                            <span className="quota-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ExcelIcon size={15} /> {t.excelRowsUsed2}</span>
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
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PdfIcon size={13} /> {t.extraPdfPagesAddon}</span>
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
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ExcelIcon size={13} /> {t.extraExcelRowsAddon}</span>
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
            <h3 style={{ marginBottom: '1.5rem' }}>{t.subscriptionPlans}</h3>
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
                                <div className="plan-badge">{t.mostPopular}</div>
                            )}
                            {isCurrentPlan && (
                                <div className="plan-badge plan-badge--current">{t.currentPlan}</div>
                            )}

                            <div className="plan-header">
                                <h4>{plan.name}</h4>
                                <div className="plan-price">
                                    <span className="price-amount">{plan.priceLabel}</span>
                                    <span className="price-period">{t.perMonth}</span>
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
                                    {t.currentlyChosen}
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
                                    {t.downgradeTo(plan.name)}
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
                                    {isSubscribed ? t.upgradeTo(plan.name) : t.subscribeTo(plan.priceLabel)}
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="downgrade-notice">
                {t.downgradeNotice}
            </p>

            {/* Add-ons */}
            <h3 style={{ marginBottom: '1.5rem', marginTop: '2.5rem' }}>{t.addons}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '-1rem' }}>
                {t.addonsDesc}
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
                                <p className="addon-description">{addon.addonType === 'pages' ? t.addlPdfDesc : t.addlRowsDesc}</p>
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
                                <span className="addon-summary-label">{t.oneTimePayment}</span>
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
                                {t.purchaseItem(selected.label)}
                            </a>
                        </div>
                    );
                })}
            </div>

            {/* Admin-only test payment section */}
            {isAdmin && (
                <div className="test-section">
                    <div className="test-section-header">
                        <FlaskConical size={18} />
                        <h3>{t.testPayments} <span className="admin-badge">{t.adminOnly}</span></h3>
                    </div>
                    <p className="test-section-desc">
                        {t.testPaymentsDesc} <code>4242 4242 4242 4242</code>{t.testPaymentsDesc2}
                    </p>
                    <div className="test-payments-grid">
                        {TEST_PAYMENTS.map((tp) => (
                            <div key={tp.id} className="test-payment-card">
                                <div className="test-payment-info">
                                    <span className={`test-type-badge test-type-badge--${tp.type}`}>
                                        {tp.type === 'subscription' ? t.subscriptionBadge : t.addonBadge}
                                    </span>
                                    <p className="test-payment-label">{tp.label}</p>
                                    <p className="test-payment-desc">{tp.description}</p>
                                </div>
                                <a
                                    href={tp.stripeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-test"
                                >
                                    <ExternalLink size={14} />
                                    {t.openTestCheckout}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
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
          gap: 0.25rem;
          padding: 0.85rem 0.5rem;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-muted);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .addon-pill:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(99,102,241,0.1);
          box-shadow: 0 4px 16px rgba(99,102,241,0.2);
          transform: translateY(-1px);
        }
        .addon-pill.active {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.18);
          color: var(--primary);
          box-shadow: 0 4px 20px rgba(99,102,241,0.3);
          transform: translateY(-1px);
        }
        .pill-qty { font-size: 1rem; font-weight: 700; }
        .pill-price { font-size: 0.78rem; font-weight: 500; opacity: 0.85; }
        .addon-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: rgba(99, 102, 241, 0.07);
          border: 1px solid rgba(99, 102, 241, 0.18);
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
        .test-section {
          margin-top: 2.5rem;
          padding: 1.75rem 2rem;
          background: rgba(245, 158, 11, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px dashed rgba(245, 158, 11, 0.4);
          border-radius: 1.5rem;
        }
        .test-section-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.75rem;
          color: #f59e0b;
        }
        .test-section-header h3 {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin: 0;
          color: #f59e0b;
        }
        .admin-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.55rem;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.4);
          border-radius: 0.5rem;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .test-section-desc {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 1.25rem;
          line-height: 1.6;
        }
        .test-section-desc code {
          background: rgba(255,255,255,0.08);
          padding: 0.1rem 0.4rem;
          border-radius: 0.35rem;
          font-size: 0.85rem;
          color: var(--text);
        }
        .test-payments-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        @media (max-width: 700px) {
          .test-payments-grid { grid-template-columns: 1fr; }
        }
        .test-payment-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 1rem;
        }
        .test-payment-info { flex: 1; }
        .test-type-badge {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.15rem 0.5rem;
          border-radius: 0.4rem;
          margin-bottom: 0.4rem;
        }
        .test-type-badge--subscription {
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }
        .test-type-badge--addon {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .test-payment-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 0.2rem 0;
        }
        .test-payment-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }
        .btn-test {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1rem;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.4);
          border-radius: 0.75rem;
          color: #f59e0b;
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .btn-test:hover {
          background: rgba(245, 158, 11, 0.18);
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
        }
      `}</style>
        </div>
    );
}

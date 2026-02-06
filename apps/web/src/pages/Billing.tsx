import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Check, AlertCircle, ExternalLink, TrendingUp } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    documentsPerMonth: number;
    pagesPerMonth: number;
    storageGb: number;
    supportSla: string;
    priceMonthly: number;
}

interface Entitlements {
    entitlements: {
        documentsPerMonth: number;
        pagesPerMonth: number;
        storageGb: number;
        supportSla: string;
        status: string;
    };
    usage: {
        documentsThisMonth: number;
    };
    quotaRemaining: number;
}

export default function Billing() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [plansRes, entitlementsRes] = await Promise.all([
                    axios.get('/v1/billing/plans'),
                    axios.get('/v1/billing/entitlements'),
                ]);
                setPlans(plansRes.data.plans);
                setEntitlements(entitlementsRes.data);
            } catch (error) {
                console.error('Failed to fetch billing data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleUpgrade = async (planId: string) => {
        try {
            const response = await axios.post('/v1/billing/checkout', { planId });
            if (response.data.checkoutUrl) {
                window.location.href = response.data.checkoutUrl;
            } else {
                alert(response.data.message || 'Checkout not available');
            }
        } catch (error) {
            console.error('Checkout failed:', error);
        }
    };

    const handleManageBilling = async () => {
        try {
            const response = await axios.get('/v1/billing/portal');
            if (response.data.portalUrl) {
                window.location.href = response.data.portalUrl;
            } else {
                alert(response.data.message || 'Portal not available');
            }
        } catch (error) {
            console.error('Portal failed:', error);
        }
    };

    const formatPrice = (cents: number) => {
        return `€${(cents / 100).toFixed(0)}`;
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Billing & Subscription</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Manage your subscription and view usage quotas
                    </p>
                </div>
                <button className="btn-secondary" onClick={handleManageBilling}>
                    <ExternalLink size={16} />
                    Manage Billing
                </button>
            </div>

            {/* Current Plan Status */}
            <div className="current-plan-card">
                <div className="current-plan-header">
                    <div>
                        <h3>Current Status</h3>
                        <div className="status-badge" data-status={entitlements?.entitlements.status}>
                            {entitlements?.entitlements.status === 'trialing' ? 'Free Trial' :
                                entitlements?.entitlements.status === 'active' ? 'Active' :
                                    entitlements?.entitlements.status || 'Unknown'}
                        </div>
                    </div>
                    <CreditCard size={32} color="var(--primary)" />
                </div>

                <div className="quota-grid">
                    <div className="quota-item">
                        <span className="quota-label">Documents this month</span>
                        <span className="quota-value">
                            {entitlements?.usage.documentsThisMonth || 0} / {entitlements?.entitlements.documentsPerMonth || 0}
                        </span>
                        <div className="quota-bar">
                            <div
                                className="quota-fill"
                                style={{
                                    width: `${Math.min(100, ((entitlements?.usage.documentsThisMonth || 0) / (entitlements?.entitlements.documentsPerMonth || 1)) * 100)}%`
                                }}
                            />
                        </div>
                    </div>
                    <div className="quota-item">
                        <span className="quota-label">Storage</span>
                        <span className="quota-value">{entitlements?.entitlements.storageGb || 0} GB</span>
                    </div>
                    <div className="quota-item">
                        <span className="quota-label">Support SLA</span>
                        <span className="quota-value" style={{ textTransform: 'capitalize' }}>
                            {entitlements?.entitlements.supportSla || 'Standard'}
                        </span>
                    </div>
                </div>

                {(entitlements?.quotaRemaining || 0) < 10 && (
                    <div className="quota-warning">
                        <AlertCircle size={16} />
                        <span>Running low on quota! Consider upgrading your plan.</span>
                    </div>
                )}
            </div>

            {/* Available Plans */}
            <h3 style={{ marginBottom: '1.5rem' }}>Available Plans</h3>
            <div className="plans-grid">
                {plans.map((plan) => (
                    <div key={plan.id} className="plan-card">
                        <div className="plan-header">
                            <h4>{plan.name}</h4>
                            <div className="plan-price">
                                <span className="price-amount">{formatPrice(plan.priceMonthly)}</span>
                                <span className="price-period">/month</span>
                            </div>
                        </div>

                        <ul className="plan-features">
                            <li>
                                <Check size={16} color="var(--success)" />
                                <span>{plan.documentsPerMonth === -1 ? 'Unlimited' : plan.documentsPerMonth.toLocaleString()} documents/month</span>
                            </li>
                            <li>
                                <Check size={16} color="var(--success)" />
                                <span>{plan.pagesPerMonth === -1 ? 'Unlimited' : plan.pagesPerMonth.toLocaleString()} pages/month</span>
                            </li>
                            <li>
                                <Check size={16} color="var(--success)" />
                                <span>{plan.storageGb} GB storage</span>
                            </li>
                            <li>
                                <Check size={16} color="var(--success)" />
                                <span style={{ textTransform: 'capitalize' }}>{plan.supportSla} support</span>
                            </li>
                        </ul>

                        <button
                            className="btn-primary"
                            onClick={() => handleUpgrade(plan.id)}
                            style={{ width: '100%', marginTop: 'auto' }}
                        >
                            <TrendingUp size={16} />
                            Upgrade to {plan.name}
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text);
          cursor: pointer;
        }
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
        .current-plan-header h3 {
          margin-bottom: 0.5rem;
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
          color: var(--success);
        }
        .quota-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        .quota-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .quota-label {
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .quota-value {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .quota-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .quota-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 3px;
          transition: width 0.3s;
        }
        .quota-warning {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 0.75rem;
          color: #f59e0b;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 1000px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }
        }
        .plan-card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
        }
        .plan-header {
          margin-bottom: 1.5rem;
        }
        .plan-header h4 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
        }
        .price-amount {
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
        }
        .price-period {
          color: var(--text-muted);
        }
        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem 0;
          flex: 1;
        }
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
        }
      `}</style>
        </div>
    );
}

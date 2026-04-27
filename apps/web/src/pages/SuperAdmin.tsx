import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Building2, Plus, X, Lock, RefreshCw, CheckCircle } from 'lucide-react';

const SESSION_KEY = 'superadmin_secret';

interface TenantRow {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    pagesLimit: number;
    rowsLimit: number;
    memberCount: number;
    ownerEmail: string | null;
    ownerName: string | null;
    subscriptionStatus: string;
}

function api(secret: string) {
    return axios.create({
        headers: { 'X-Superadmin-Secret': secret },
    });
}

// ── Lock screen ───────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: (secret: string) => void }) {
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setChecking(true);
        setError('');
        try {
            await axios.get('/v1/superadmin/tenants', {
                headers: { 'X-Superadmin-Secret': value },
            });
            sessionStorage.setItem(SESSION_KEY, value);
            onUnlock(value);
        } catch {
            setError('Wrong secret — try again.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div style={styles.lockWrap}>
            <div style={styles.lockCard}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={styles.lockIcon}><Lock size={28} color="#6366f1" /></div>
                    <h2 style={{ margin: '0.75rem 0 0.25rem', color: 'var(--text)' }}>Superadmin</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Enter your superadmin secret to continue</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Superadmin secret"
                        autoFocus
                        style={styles.input}
                    />
                    {error && <p style={styles.errText}>{error}</p>}
                    <button type="submit" disabled={checking || !value} style={{ ...styles.btnPrimary, width: '100%', marginTop: '1rem' }}>
                        {checking ? 'Verifying…' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
    const [secret, setSecret] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
    const [tenants, setTenants] = useState<TenantRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // form
    const [tenantName, setTenantName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerPassword, setOwnerPassword] = useState('');
    const [pagesLimit, setPagesLimit] = useState('1000');
    const [rowsLimit, setRowsLimit] = useState('1000');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState<{ name: string; email: string } | null>(null);

    const fetchTenants = useCallback(async (s: string) => {
        setLoading(true);
        try {
            const res = await api(s).get('/v1/superadmin/tenants');
            setTenants(res.data.tenants);
        } catch {
            sessionStorage.removeItem(SESSION_KEY);
            setSecret(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (secret) fetchTenants(secret);
    }, [secret, fetchTenants]);

    const handleUnlock = (s: string) => setSecret(s);

    const resetForm = () => {
        setTenantName(''); setOwnerEmail(''); setOwnerName('');
        setOwnerPassword(''); setPagesLimit('1000'); setRowsLimit('1000');
        setCreateError(''); setCreateSuccess(null);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError('');
        setCreateSuccess(null);
        try {
            const res = await api(secret!).post('/v1/superadmin/tenants', {
                tenantName,
                ownerEmail,
                ownerName: ownerName || undefined,
                ownerPassword,
                pagesLimit: parseInt(pagesLimit),
                rowsLimit: parseInt(rowsLimit),
            });
            setCreateSuccess({ name: res.data.tenantName, email: res.data.ownerEmail });
            await fetchTenants(secret!);
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to create tenant';
            setCreateError(msg);
        } finally {
            setCreating(false);
        }
    };

    const statusColor = (s: string) => {
        if (s === 'active') return '#22c55e';
        if (s === 'trialing') return '#f59e0b';
        if (s === 'canceled' || s === 'past_due') return '#ef4444';
        return 'var(--text-muted)';
    };

    if (!secret) return <LockScreen onUnlock={handleUnlock} />;

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Building2 size={24} color="#6366f1" />
                    <h2 style={{ margin: 0 }}>Superadmin — Tenants</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => fetchTenants(secret)} style={styles.btnSecondary} disabled={loading}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button onClick={() => { resetForm(); setShowForm(true); }} style={styles.btnPrimary}>
                        <Plus size={15} /> New Tenant
                    </button>
                </div>
            </div>

            {/* Tenant table */}
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                {['Company', 'Owner', 'Members', 'Pages / Rows limit', 'Subscription', 'Created'].map(h => (
                                    <th key={h} style={styles.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={styles.td}>
                                        <strong>{t.name}</strong>
                                        <br />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.slug}</span>
                                    </td>
                                    <td style={styles.td}>
                                        {t.ownerName && <>{t.ownerName}<br /></>}
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.ownerEmail ?? '—'}</span>
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>{t.memberCount}</td>
                                    <td style={styles.td}>
                                        {t.pagesLimit.toLocaleString()} / {t.rowsLimit.toLocaleString()}
                                    </td>
                                    <td style={styles.td}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '0.2rem 0.65rem',
                                            borderRadius: '1rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            background: statusColor(t.subscriptionStatus) + '22',
                                            color: statusColor(t.subscriptionStatus),
                                        }}>
                                            {t.subscriptionStatus}
                                        </span>
                                    </td>
                                    <td style={{ ...styles.td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {new Date(t.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {tenants.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No tenants yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Tenant Modal */}
            {showForm && (
                <div style={styles.overlay} onClick={() => setShowForm(false)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>New Tenant</h3>
                            <button onClick={() => setShowForm(false)} style={styles.iconBtn}><X size={20} /></button>
                        </div>

                        {createSuccess ? (
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
                                <h4 style={{ color: '#22c55e', margin: '0 0 0.5rem' }}>Tenant created!</h4>
                                <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>
                                    <strong>{createSuccess.name}</strong> — owner: {createSuccess.email}
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => { resetForm(); }} style={{ ...styles.btnPrimary, flex: 1 }}>Create Another</button>
                                    <button onClick={() => setShowForm(false)} style={{ ...styles.btnSecondary, flex: 1 }}>Done</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleCreate}>
                                <p style={{ margin: '0 0 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company</p>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Company name *</label>
                                    <input style={styles.input} value={tenantName} onChange={e => setTenantName(e.target.value)} required placeholder="Acme Ltd" />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ ...styles.formGroup, flex: 1 }}>
                                        <label style={styles.label}>Pages limit</label>
                                        <input style={styles.input} type="number" min={1} value={pagesLimit} onChange={e => setPagesLimit(e.target.value)} />
                                    </div>
                                    <div style={{ ...styles.formGroup, flex: 1 }}>
                                        <label style={styles.label}>Rows limit</label>
                                        <input style={styles.input} type="number" min={1} value={rowsLimit} onChange={e => setRowsLimit(e.target.value)} />
                                    </div>
                                </div>

                                <p style={{ margin: '0.5rem 0 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Owner account</p>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Email *</label>
                                    <input style={styles.input} type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} required placeholder="owner@company.com" />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Full name</label>
                                    <input style={styles.input} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Jane Smith" />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Password *</label>
                                    <input style={styles.input} type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" />
                                </div>

                                {createError && (
                                    <div style={styles.errBox}>{createError}</div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                    <button type="submit" style={{ ...styles.btnPrimary, flex: 1 }} disabled={creating}>
                                        {creating ? 'Creating…' : 'Create Tenant'}
                                    </button>
                                    <button type="button" style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowForm(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    page: {
        padding: '2rem',
        maxWidth: 1100,
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    card: {
        background: 'var(--surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: '1rem',
    },
    th: {
        padding: '0.9rem 1.25rem',
        textAlign: 'left' as const,
        color: 'var(--text-muted)',
        fontWeight: 600,
        fontSize: '0.82rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    td: {
        padding: '0.85rem 1.25rem',
        color: 'var(--text)',
        fontSize: '0.93rem',
        verticalAlign: 'middle' as const,
    },
    btnPrimary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.6rem 1.25rem',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        border: 'none',
        borderRadius: '0.75rem',
        color: 'white',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
    btnSecondary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.6rem 1.25rem',
        background: 'var(--surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: '0.75rem',
        color: 'var(--text)',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
    iconBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: '0.25rem',
    },
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
    },
    modal: {
        background: 'var(--surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: '1.5rem',
        padding: '2rem',
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        marginBottom: '1rem',
    },
    label: {
        fontSize: '0.82rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.03em',
    },
    input: {
        width: '100%',
        padding: '0.65rem 1rem',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--glass-border)',
        borderRadius: '0.75rem',
        color: 'var(--text)',
        fontSize: '0.95rem',
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    errBox: {
        padding: '0.75rem 1rem',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '0.5rem',
        color: '#ef4444',
        fontSize: '0.9rem',
    },
    errText: {
        color: '#ef4444',
        fontSize: '0.85rem',
        margin: '0.5rem 0 0',
    },
    lockWrap: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background, #0f0f1a)',
        padding: '1rem',
    },
    lockCard: {
        background: 'var(--surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: '1.5rem',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
    },
    lockIcon: {
        display: 'inline-flex',
        padding: '1rem',
        background: 'rgba(99,102,241,0.12)',
        borderRadius: '1rem',
    },
};

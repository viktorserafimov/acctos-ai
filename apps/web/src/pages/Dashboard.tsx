import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Zap, FileText, TrendingUp, RefreshCw, Euro, Download, Brain, Settings, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UsageSummary {
    period: string;
    from: string;
    to: string;
    summary: Record<string, { eventCount: number; totalCost: string; totalTokens: number }>;
    totals: { events: number; cost: string; currency: string };
}

interface TimeseriesPoint {
    date: string;
    make: { events: number; cost: number };
    azure: { events: number; cost: number };
    openai: { events: number; cost: number };
    total: { events: number; cost: number };
}

interface DocumentUsageData {
    customerId: string;
    from: string | null;
    to: string | null;
    days: Array<{
        date: string;
        pagesSpent: number;
        rowsUsed: number;
    }>;
    totals: {
        pagesSpent: number;
        rowsUsed: number;
    };
}

// ... inside Dashboard component ...

export default function Dashboard() {
    const { isAdmin } = useAuth();

    // 1. All State Hooks
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
    const [documentUsage, setDocumentUsage] = useState<DocumentUsageData | null>(null);
    type OpenAICostData = { inputTokens: number; outputTokens: number; totalTokens: number; costEur: string };
    const [openaiCostsMap, setOpenaiCostsMap] = useState<Record<string, OpenAICostData>>({});
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30d');

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [makeApiKey, setMakeApiKey] = useState('');
    const [makeFolderId, setMakeFolderId] = useState('');
    const [makeOrgId, setMakeOrgId] = useState('');
    const [azureApiKey, setAzureApiKey] = useState('');
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
    const [testingAzureConnection, setTestingAzureConnection] = useState(false);
    const [azureConnectionStatus, setAzureConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'infrastructure' | 'document'>(isAdmin ? 'infrastructure' : 'document');
    const [syncCooldown, setSyncCooldown] = useState(false);
    const [scenarioActionLoading, setScenarioActionLoading] = useState(false);
    const [scenarioActionError, setScenarioActionError] = useState<string | null>(null);
    const [resettingUsage, setResettingUsage] = useState(false);

    // Usage limits (for Document Usage tab)
    const [usageLimits, setUsageLimits] = useState<{
        pagesLimit: number; rowsLimit: number;
        addonPagesLimit: number; addonRowsLimit: number;
        addonPagesUsed: number; addonRowsUsed: number;
        scenariosPaused: boolean;
    } | null>(null);

    // 2. Helper Functions
    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('Fetching dashboard data for period:', period);
            const days = period.replace('d', '');
            const [summaryRes, timeseriesRes] = await Promise.allSettled([
                axios.get(`/v1/usage/summary?period=${period}`),
                axios.get(`/v1/usage/timeseries?days=${days}`),
            ]);
            if (summaryRes.status === 'fulfilled') {
                console.log('Dashboard data received:', summaryRes.value.data);
                setSummary(summaryRes.value.data);
            }
            if (timeseriesRes.status === 'fulfilled') {
                setTimeseries(timeseriesRes.value.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch usage data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetches OpenAI token costs for both supported periods in one go.
    // Runs once on mount (and on manual sync) so switching the period filter
    // is instant — no extra API calls needed.
    const fetchOpenAICosts = async () => {
        const [res7, res30] = await Promise.allSettled([
            axios.get('/v1/usage/openai-costs?days=7'),
            axios.get('/v1/usage/openai-costs?days=30'),
        ]);
        setOpenaiCostsMap(prev => {
            const next = { ...prev };
            if (res7.status  === 'fulfilled') next['7']  = res7.value.data;
            if (res30.status === 'fulfilled') next['30'] = res30.value.data;
            return next;
        });
    };

    const fetchDocumentUsage = async () => {
        setLoading(true);
        try {
            console.log('Fetching document usage data for period:', period);

            // Calculate date range based on period
            const days = parseInt(period.replace('d', ''));
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - days);

            const from = fromDate.toISOString().split('T')[0];
            const to = toDate.toISOString().split('T')[0];

            const [docRes, limitsRes] = await Promise.allSettled([
                axios.get('/v1/usage/document-usage', { params: { from, to } }),
                axios.get('/v1/billing/usage-status'),
            ]);

            if (docRes.status === 'fulfilled') {
                console.log('Document usage data received:', docRes.value.data);
                setDocumentUsage(docRes.value.data);
            }
            if (limitsRes.status === 'fulfilled') {
                const d = limitsRes.value.data;
                setUsageLimits({
                    pagesLimit: d.pagesLimit,
                    rowsLimit: d.rowsLimit,
                    addonPagesLimit: d.addonPagesLimit,
                    addonRowsLimit: d.addonRowsLimit,
                    addonPagesUsed: d.addonPagesUsed,
                    addonRowsUsed: d.addonRowsUsed,
                    scenariosPaused: d.scenariosPaused,
                });
            }
        } catch (error) {
            console.error('Failed to fetch document usage data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        if (syncCooldown) return;

        setSyncCooldown(true);
        setTimeout(() => setSyncCooldown(false), 5000);

        setLoading(true);
        try {
            if (activeTab === 'document') {
                await fetchDocumentUsage();
            } else {
                // Trigger backend sync then refresh all data including OpenAI costs
                await axios.post('/v1/integrations/make/sync');
                await Promise.all([fetchData(), fetchOpenAICosts()]);
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setLoading(false);
            alert('Failed to sync data');
        }
    };

    const handlePauseScenarios = async () => {
        setScenarioActionLoading(true);
        setScenarioActionError(null);
        try {
            const res = await axios.post('/v1/integrations/make/pause-all');
            if (res.data.scenariosPaused === 0 && res.data.scenariosFailed > 0) {
                setScenarioActionError(
                    `Pause failed: all ${res.data.scenariosFailed} scenario(s) returned an error from Make.com. Check the server logs for details.`
                );
            }
            await fetchDocumentUsage();
        } catch {
            setScenarioActionError('Pause failed: could not reach the server. Check your Make.com API key.');
        } finally {
            setScenarioActionLoading(false);
        }
    };

    const handleResumeScenarios = async () => {
        setScenarioActionLoading(true);
        setScenarioActionError(null);
        try {
            const res = await axios.post('/v1/integrations/make/resume-all');
            if (res.data.scenariosResumed === 0 && res.data.scenariosFailed > 0) {
                setScenarioActionError(
                    `Resume failed: all ${res.data.scenariosFailed} scenario(s) returned an error from Make.com. Check the server logs for details.`
                );
            }
            await fetchDocumentUsage();
        } catch {
            setScenarioActionError('Resume failed: could not reach the server. Check your Make.com API key.');
        } finally {
            setScenarioActionLoading(false);
        }
    };

    const handleResetUsage = async () => {
        if (!window.confirm(
            'This will permanently delete ALL pages and rows usage data, resetting both counters to 0 everywhere.\n\nMake.com, Azure, and OpenAI usage data will NOT be affected.\n\nContinue?'
        )) return;
        setResettingUsage(true);
        try {
            await axios.post('/v1/billing/reset-usage');
            // Refresh both tabs so all views show 0
            await Promise.all([fetchDocumentUsage(), fetchData()]);
        } catch {
            alert('Reset failed. Make sure you have admin privileges.');
        } finally {
            setResettingUsage(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/profile', {
                makeApiKey,
                makeFolderId,
                makeOrgId,
                azureApiKey,
                azureEndpoint
            });
            alert('Settings saved successfully!');
            setShowSettings(false);
            setMakeApiKey(''); // Clear secrets from memory
            setAzureApiKey('');
        } catch (error) {
            alert('Failed to save settings.');
            console.error(error);
        }
    };

    const testAzureConnection = async () => {
        setTestingAzureConnection(true);
        setAzureConnectionStatus(null);
        try {
            if (azureApiKey || azureEndpoint) {
                await axios.post('/api/auth/profile', { azureApiKey: azureApiKey || undefined, azureEndpoint: azureEndpoint || undefined });
            }
            const res = await axios.get('/v1/integrations/azure/check');
            setAzureConnectionStatus({
                success: true,
                message: `Connected! ${res.data.modelsAvailable} model(s) available.`,
            });
        } catch (error: any) {
            setAzureConnectionStatus({
                success: false,
                message: error.response?.data?.error?.message || 'Connection failed',
            });
        } finally {
            setTestingAzureConnection(false);
        }
    };

    const testMakeConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            // First save the keys if they are typed in
            if (makeApiKey) {
                await axios.post('/api/auth/profile', { makeApiKey });
            }

            const res = await axios.get('/v1/integrations/make/check');
            setConnectionStatus({
                success: true,
                message: `Connected to EU2 Zone! User: ${res.data.user.name} (${res.data.user.email})`
            });
        } catch (error: any) {
            setConnectionStatus({
                success: false,
                message: error.response?.data?.message || 'Connection failed'
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`/v1/usage/exports?days=${period.replace('d', '')}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `usage-export-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    // 3. Effects
    useEffect(() => {
        if (activeTab === 'infrastructure') {
            fetchData();
        } else {
            fetchDocumentUsage();
        }
    }, [period, activeTab]);

    // Fetch OpenAI costs for both periods once on mount
    useEffect(() => { fetchOpenAICosts(); }, []);

    // Fetch integration config when settings open
    useEffect(() => {
        if (showSettings) {
            const loadProfile = async () => {
                try {
                    const res = await axios.get('/api/auth/me');
                    const integrations = res.data.integrations;
                    if (integrations) {
                        setMakeOrgId(integrations.makeOrgId || '');
                        setMakeFolderId(integrations.makeFolderId || '');
                        setAzureEndpoint(integrations.azureEndpoint || '');
                    }
                } catch (err) { console.error(err); }
            };
            loadProfile();
        }
    }, [showSettings]);

    console.log('Dashboard render:', { loading, summary, timeseriesCount: timeseries.length });

    // 4. Derived State
    // Transform timeseries for chart
    const chartData = timeseries.map((point) => ({
        date: point.date,
        'Make.com Credits': point.make.cost,
        'Azure OCR': point.azure.cost,
        'OpenAI': point.openai.cost,
    }));

    // Pricing calculations
    // Make.com: 1.06 EUR per 1,000 credits
    const makeCredits = parseFloat(summary?.summary?.make?.totalCost || '0');
    const makeEurCost = makeCredits * 1.06 / 1000;
    // Azure OCR: 1.50 EUR per 1,000 pages (each event = 1 page)
    const azurePages = summary?.summary?.azure?.eventCount || 0;
    const azureEurCost = azurePages * 1.50 / 1000;
    // OpenAI: real cost fetched directly from OpenAI API (GPT-4o pricing, converted to EUR)
    const openaiCosts = openaiCostsMap[period.replace('d', '')] ?? null;
    const openaiCost = parseFloat(openaiCosts?.costEur || '0');
    // Total across all sources
    const eurTotal = (makeEurCost + azureEurCost + openaiCost).toFixed(2);
    const totalEvents = (summary?.summary?.make?.eventCount || 0) + azurePages + (summary?.summary?.openai?.eventCount || 0);

    // 5. Render
    if (loading && !summary) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading usage data...</p>
            </div>
        );
    }

    return (

        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h2>Usage Dashboard</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Track your document processing usage across all platforms
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="period-select"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                    <button className="btn-secondary" onClick={handleExport}>
                        <Download size={16} />
                        Export
                    </button>
                    <button className="btn-secondary" onClick={handleSync} disabled={syncCooldown || loading}>
                        <RefreshCw size={16} />
                        {syncCooldown ? 'Wait...' : 'Refresh / Sync'}
                    </button>
                    <button className="btn-secondary" onClick={() => setShowSettings(true)}>
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="tab-switcher">
                {isAdmin && (
                    <button
                        className={`tab-btn ${activeTab === 'infrastructure' ? 'active' : ''}`}
                        onClick={() => setActiveTab('infrastructure')}
                    >
                        Infrastructure Usage
                    </button>
                )}
                <button
                    className={`tab-btn ${activeTab === 'document' ? 'active' : ''}`}
                    onClick={() => setActiveTab('document')}
                >
                    Document Usage
                </button>
            </div>

            {isAdmin && activeTab === 'infrastructure' ? (
                <>
                    {/* Make.com scenario controls */}
                    <div className="scenario-controls">
                        <div className="scenario-status">
                            <span
                                className="scenario-status-dot"
                                style={{ background: usageLimits?.scenariosPaused ? '#ef4444' : '#10b981' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                Scenarios: <strong style={{ color: 'var(--text)' }}>
                                    {usageLimits?.scenariosPaused ? 'Paused' : 'Running'}
                                </strong>
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="sc-btn sc-btn-pause"
                                onClick={handlePauseScenarios}
                                disabled={scenarioActionLoading || usageLimits?.scenariosPaused === true}
                            >
                                {scenarioActionLoading ? 'Working…' : 'Pause Scenarios'}
                            </button>
                            <button
                                className="sc-btn sc-btn-resume"
                                onClick={handleResumeScenarios}
                                disabled={scenarioActionLoading || usageLimits?.scenariosPaused === false}
                            >
                                {scenarioActionLoading ? 'Working…' : 'Resume Scenarios'}
                            </button>
                            <button
                                className="sc-btn sc-btn-reset"
                                onClick={handleResetUsage}
                                disabled={resettingUsage}
                            >
                                {resettingUsage ? 'Resetting…' : 'Reset Pages & Rows'}
                            </button>
                        </div>
                    </div>

                    {/* Scenario action error */}
                    {scenarioActionError && (
                        <div className="sc-error-banner">
                            <span>⚠ {scenarioActionError}</span>
                            <button className="sc-error-dismiss" onClick={() => setScenarioActionError(null)}>✕</button>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <div className="card">
                            <div className="card-title">
                                <h3>Make.com</h3>
                                <Zap size={20} color="#6366f1" />
                            </div>
                            <div className="usage-value">
                                {parseFloat(summary?.summary?.make?.totalCost || '0').toFixed(2)}
                                <span className="usage-unit">credits</span>
                            </div>
                            <div className="cost-display">
                                <Zap size={18} />
                                <span>{summary?.summary?.make?.eventCount || 0} operations</span>
                            </div>
                            <div className="cost-display" style={{ marginTop: '0.25rem' }}>
                                <Euro size={18} />
                                <span>{makeEurCost.toFixed(2)} EUR</span>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">
                                <h3>Azure OCR</h3>
                                <FileText size={20} color="#ec4899" />
                            </div>
                            <div className="usage-value">
                                {summary?.summary?.azure?.eventCount || 0}
                                <span className="usage-unit">events</span>
                            </div>
                            <div className="cost-display">
                                <Euro size={18} />
                                <span>{azureEurCost.toFixed(2)} EUR</span>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">
                                <h3>OpenAI</h3>
                                <Brain size={20} color="#10b981" />
                            </div>
                            <div className="usage-value">
                                {(openaiCosts?.totalTokens ?? 0).toLocaleString()}
                                <span className="usage-unit">tokens</span>
                            </div>
                            <div className="cost-display" style={{ marginTop: '0.5rem' }}>
                                <Euro size={18} />
                                <span>{openaiCosts?.costEur ?? '0.00'} EUR</span>
                            </div>
                            <div className="cost-display" style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span>↑ {(openaiCosts?.inputTokens ?? 0).toLocaleString()} in</span>
                                <span style={{ marginLeft: '0.5rem' }}>↓ {(openaiCosts?.outputTokens ?? 0).toLocaleString()} out</span>
                            </div>
                        </div>

                        <div className="card aggregate-card">
                            <div className="card-title">
                                <h3>Total Cost</h3>
                                <TrendingUp size={20} color="#f59e0b" />
                            </div>
                            <div className="usage-value" style={{ color: '#f59e0b' }}>
                                {eurTotal}
                                <span className="usage-unit">EUR</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                                {totalEvents} total events across all sources in {period}
                            </p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="chart-section">
                        <h3 style={{ marginBottom: '1.5rem' }}>Usage Over Time</h3>
                        <div style={{ height: 400 }}>
                            <ResponsiveContainer>
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" stroke="var(--text-muted)" />
                                    <YAxis stroke="var(--text-muted)" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            borderRadius: '0.75rem',
                                            border: '1px solid var(--glass-border)',
                                        }}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="Make.com Credits" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                                    <Area type="monotone" dataKey="Azure OCR" stroke="#ec4899" fill="#ec4899" fillOpacity={0.1} />
                                    <Area type="monotone" dataKey="OpenAI" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Paused notice */}
                    {usageLimits?.scenariosPaused && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '1rem 1.25rem',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '1rem', color: '#ef4444',
                            marginBottom: '1.5rem', fontSize: '0.9rem'
                        }}>
                            <TrendingUp size={18} />
                            <span><strong>Agent Paused</strong> — usage limit reached. Go to the Billing tab to resume or purchase add-ons.</span>
                        </div>
                    )}

                    <div className="stats-grid">
                        {/* Pages card */}
                        <div className="card">
                            <div className="card-title">
                                <h3>Pages Spent</h3>
                                <FileText size={20} color="#6366f1" />
                            </div>
                            <div className="doc-usage-row">
                                <span className="doc-usage-current">{(documentUsage?.totals.pagesSpent || 0).toLocaleString()}</span>
                                <span className="doc-usage-sep">/</span>
                                <span className="doc-usage-limit">{(usageLimits?.pagesLimit ?? 5000).toLocaleString()}</span>
                            </div>
                            <div className="doc-quota-bar">
                                <div
                                    className="doc-quota-fill"
                                    style={{
                                        width: `${Math.min(100, ((documentUsage?.totals.pagesSpent || 0) / (usageLimits?.pagesLimit ?? 5000)) * 100)}%`,
                                        background: (documentUsage?.totals.pagesSpent || 0) >= (usageLimits?.pagesLimit ?? 5000) ? '#ef4444' : undefined,
                                    }}
                                />
                            </div>
                            {usageLimits && usageLimits.addonPagesLimit > 0 && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        Extra pages (add-on): {usageLimits.addonPagesUsed.toLocaleString()} / {usageLimits.addonPagesLimit.toLocaleString()}
                                    </p>
                                    <div className="doc-quota-bar">
                                        <div
                                            className="doc-quota-fill doc-quota-fill--addon"
                                            style={{
                                                width: `${Math.min(100, (usageLimits.addonPagesUsed / usageLimits.addonPagesLimit) * 100)}%`,
                                                background: usageLimits.addonPagesUsed >= usageLimits.addonPagesLimit ? '#ef4444' : undefined,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                                Pages processed in {period}
                            </p>
                        </div>

                        {/* Rows card */}
                        <div className="card">
                            <div className="card-title">
                                <h3>Rows Used</h3>
                                <TrendingUp size={20} color="#ec4899" />
                            </div>
                            <div className="doc-usage-row">
                                <span className="doc-usage-current">{(documentUsage?.totals.rowsUsed || 0).toLocaleString()}</span>
                                <span className="doc-usage-sep">/</span>
                                <span className="doc-usage-limit">{(usageLimits?.rowsLimit ?? 5000).toLocaleString()}</span>
                            </div>
                            <div className="doc-quota-bar">
                                <div
                                    className="doc-quota-fill"
                                    style={{
                                        width: `${Math.min(100, ((documentUsage?.totals.rowsUsed || 0) / (usageLimits?.rowsLimit ?? 5000)) * 100)}%`,
                                        background: (documentUsage?.totals.rowsUsed || 0) >= (usageLimits?.rowsLimit ?? 5000) ? '#ef4444' : undefined,
                                    }}
                                />
                            </div>
                            {usageLimits && usageLimits.addonRowsLimit > 0 && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        Extra rows (add-on): {usageLimits.addonRowsUsed.toLocaleString()} / {usageLimits.addonRowsLimit.toLocaleString()}
                                    </p>
                                    <div className="doc-quota-bar">
                                        <div
                                            className="doc-quota-fill doc-quota-fill--addon"
                                            style={{
                                                width: `${Math.min(100, (usageLimits.addonRowsUsed / usageLimits.addonRowsLimit) * 100)}%`,
                                                background: usageLimits.addonRowsUsed >= usageLimits.addonRowsLimit ? '#ef4444' : undefined,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                                Data rows extracted in {period}
                            </p>
                        </div>
                    </div>

                    {documentUsage && documentUsage.days.length > 0 && (
                        <div className="card" style={{ marginTop: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Document Usage Over Time</h3>
                            <div style={{ height: 400 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={documentUsage.days}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" stroke="var(--text-muted)" />
                                        <YAxis stroke="var(--text-muted)" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                borderRadius: '0.75rem',
                                                border: '1px solid var(--glass-border)',
                                            }}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="pagesSpent" name="Pages Spent" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                                        <Area type="monotone" dataKey="rowsUsed" name="Rows Used" stroke="#ec4899" fill="#ec4899" fillOpacity={0.1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>Integration Settings</h3>
                            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSettings}>
                            <h4 style={{ marginBottom: '0.75rem', color: '#6366f1' }}>Make.com</h4>

                            <label className="settings-label">API Key</label>
                            <input
                                type="password"
                                className="settings-input"
                                placeholder="Enter Make.com API Key"
                                value={makeApiKey}
                                onChange={(e) => setMakeApiKey(e.target.value)}
                            />

                            <label className="settings-label">Organization ID</label>
                            <input
                                type="text"
                                className="settings-input"
                                placeholder="e.g. 1054340"
                                value={makeOrgId}
                                onChange={(e) => setMakeOrgId(e.target.value)}
                            />

                            <label className="settings-label">Folder ID (optional - filters synced scenarios)</label>
                            <input
                                type="text"
                                className="settings-input"
                                placeholder="e.g. 449625"
                                value={makeFolderId}
                                onChange={(e) => setMakeFolderId(e.target.value)}
                            />

                            <button
                                type="button"
                                onClick={testMakeConnection}
                                disabled={testingConnection}
                                className="btn-secondary"
                                style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
                            >
                                {testingConnection ? 'Testing...' : 'Test Connection'}
                            </button>

                            {connectionStatus && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '1rem',
                                    color: connectionStatus.success ? '#10b981' : '#ef4444'
                                }}>
                                    {connectionStatus.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    <span style={{ fontSize: '0.85rem' }}>{connectionStatus.message}</span>
                                </div>
                            )}

                            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '1.5rem 0' }} />

                            <h4 style={{ marginBottom: '0.75rem', color: '#ec4899' }}>Azure OCR</h4>

                            <label className="settings-label">API Key</label>
                            <input
                                type="password"
                                className="settings-input"
                                placeholder="Enter Azure API Key"
                                value={azureApiKey}
                                onChange={(e) => setAzureApiKey(e.target.value)}
                            />

                            <label className="settings-label">Endpoint</label>
                            <input
                                type="text"
                                className="settings-input"
                                placeholder="https://..."
                                value={azureEndpoint}
                                onChange={(e) => setAzureEndpoint(e.target.value)}
                            />

                            <button
                                type="button"
                                onClick={testAzureConnection}
                                disabled={testingAzureConnection}
                                className="btn-secondary"
                                style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
                            >
                                {testingAzureConnection ? 'Testing...' : 'Test Azure Connection'}
                            </button>

                            {azureConnectionStatus && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '1rem',
                                    color: azureConnectionStatus.success ? '#10b981' : '#ef4444'
                                }}>
                                    {azureConnectionStatus.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    <span style={{ fontSize: '0.85rem' }}>{azureConnectionStatus.message}</span>
                                </div>
                            )}

                            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                                Save Settings
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .page-header h2 {
          font-size: 1.75rem;
        }
        .period-select {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          padding: 0.5rem 1rem;
          color: var(--text);
          cursor: pointer;
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
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
        .tab-switcher {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 0.25rem;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          width: fit-content;
        }
        .tab-btn {
          padding: 0.6rem 1.5rem;
          border: none;
          background: none;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          border-radius: 0.75rem;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--text);
        }
        .tab-btn.active {
          background: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .scenario-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.25rem;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          margin-bottom: 1.5rem;
        }
        .scenario-status {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .scenario-status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sc-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 1rem;
          border: none;
          border-radius: 0.65rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .sc-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .sc-btn-pause {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .sc-btn-pause:not(:disabled):hover { background: rgba(239, 68, 68, 0.25); }
        .sc-btn-resume {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .sc-btn-resume:not(:disabled):hover { background: rgba(16, 185, 129, 0.25); }
        .sc-btn-reset {
          background: rgba(99, 102, 241, 0.12);
          color: var(--primary);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }
        .sc-btn-reset:not(:disabled):hover { background: rgba(99, 102, 241, 0.22); }
        .sc-error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 1.25rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 0.75rem;
          color: #ef4444;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .sc-error-dismiss {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 1rem;
          padding: 0;
          flex-shrink: 0;
          opacity: 0.7;
        }
        .sc-error-dismiss:hover { opacity: 1; }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 1.5rem;
        }
        .card-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .card-title h3 {
          font-size: 1rem;
          color: var(--text-muted);
        }
        .usage-value {
          font-size: 2.5rem;
          font-weight: 700;
        }
        .usage-unit {
          font-size: 1rem;
          font-weight: 400;
          color: var(--text-muted);
          margin-left: 0.5rem;
        }
        .cost-display {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          color: var(--primary);
          font-weight: 600;
        }
        .aggregate-card {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1));
        }
        .chart-section {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 1.5rem;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--background, #0f172a);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          width: 100%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
        }
        .settings-label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
          margin-top: 0.75rem;
        }
        .settings-input {
          width: 100%;
          padding: 0.6rem 1rem;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text);
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .settings-input:focus {
          outline: none;
          border-color: var(--primary);
        }
        .btn-primary {
          padding: 0.75rem 1.5rem;
          background: var(--primary, #6366f1);
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .doc-usage-row {
          display: flex;
          align-items: baseline;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
        }
        .doc-usage-current {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
        }
        .doc-usage-sep {
          font-size: 1.5rem;
          font-weight: 400;
          color: var(--text-muted);
        }
        .doc-usage-limit {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .doc-quota-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 0.5rem;
        }
        .doc-quota-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .doc-quota-fill--addon {
          background: linear-gradient(90deg, #f59e0b, #ec4899);
        }
      `}</style>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Zap, FileText, TrendingUp, RefreshCw, Euro, Download, Brain, Settings, X, CheckCircle, AlertCircle } from 'lucide-react';

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


// ... inside Dashboard component ...

export default function Dashboard() {
    // 1. All State Hooks
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
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
    const [activeTab, setActiveTab] = useState<'infrastructure' | 'document'>('infrastructure');

    // 2. Helper Functions
    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('Fetching dashboard data for period:', period);
            const [summaryRes, timeseriesRes] = await Promise.all([
                axios.get(`/v1/usage/summary?period=${period}`),
                axios.get(`/v1/usage/timeseries?days=${period.replace('d', '')}`),
            ]);
            console.log('Dashboard data received:', { summary: summaryRes.data, timeseries: timeseriesRes.data });
            setSummary(summaryRes.data);
            setTimeseries(timeseriesRes.data.data);
        } catch (error) {
            console.error('Failed to fetch usage data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setLoading(true);
        try {
            // Trigger backend sync
            await axios.post('/v1/integrations/make/sync');
            // Then refresh data
            await fetchData();
        } catch (error) {
            console.error('Sync failed:', error);
            setLoading(false);
            alert('Failed to sync data with Make.com');
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
        fetchData();
    }, [period]);

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

    // Calculate EUR-only total (Azure + OpenAI, excluding Make.com credits)
    const azureCost = parseFloat(summary?.summary?.azure?.totalCost || '0');
    const openaiCost = parseFloat(summary?.summary?.openai?.totalCost || '0');
    const eurTotal = (azureCost + openaiCost).toFixed(4);
    const eurEvents = (summary?.summary?.azure?.eventCount || 0) + (summary?.summary?.openai?.eventCount || 0);

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
                        <option value="90d">Last 90 days</option>
                    </select>
                    <button className="btn-secondary" onClick={handleExport}>
                        <Download size={16} />
                        Export
                    </button>
                    <button className="btn-secondary" onClick={handleSync}>
                        <RefreshCw size={16} />
                        Refresh / Sync
                    </button>
                    <button className="btn-secondary" onClick={() => setShowSettings(true)}>
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="tab-switcher">
                <button
                    className={`tab-btn ${activeTab === 'infrastructure' ? 'active' : ''}`}
                    onClick={() => setActiveTab('infrastructure')}
                >
                    Infrastructure Usage
                </button>
                <button
                    className={`tab-btn ${activeTab === 'document' ? 'active' : ''}`}
                    onClick={() => setActiveTab('document')}
                >
                    Document Usage
                </button>
            </div>

            {activeTab === 'infrastructure' ? (
                <>
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
                                <span>{summary?.summary?.azure?.totalCost || '0.00'} EUR</span>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">
                                <h3>OpenAI</h3>
                                <Brain size={20} color="#10b981" />
                            </div>
                            <div className="usage-value">
                                {summary?.summary?.openai?.totalTokens || 0}
                                <span className="usage-unit">tokens</span>
                            </div>
                            <div className="cost-display">
                                <Euro size={18} />
                                <span>{summary?.summary?.openai?.totalCost || '0.00'} EUR</span>
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
                                {eurEvents} Azure + OpenAI events in {period}
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
                <div className="stats-grid">
                    <div className="card">
                        <div className="card-title">
                            <h3>Pages Spent</h3>
                            <FileText size={20} color="#6366f1" />
                        </div>
                        <div className="usage-value">
                            0
                            <span className="usage-unit">pages</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                            Total number of pages processed in {period}
                        </p>
                    </div>

                    <div className="card">
                        <div className="card-title">
                            <h3>Rows Used</h3>
                            <TrendingUp size={20} color="#ec4899" />
                        </div>
                        <div className="usage-value">
                            0
                            <span className="usage-unit">rows</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                            Total number of data rows extracted in {period}
                        </p>
                    </div>
                </div>
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
      `}</style>
        </div>
    );
}

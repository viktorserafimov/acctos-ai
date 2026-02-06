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
    const [azureApiKey, setAzureApiKey] = useState('');
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

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
                azureApiKey,
                azureEndpoint
            });
            alert('Settings saved successfully!');
            setShowSettings(false);
            setMakeApiKey(''); // Clear from memory
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

    // Fetch keys (partial obfuscated) when settings open
    useEffect(() => {
        if (showSettings) {
            const loadProfile = async () => {
                try {
                    const res = await axios.get('/api/auth/me');
                    // We don't get actual keys back for security, but we could if we wanted to show placeholders
                    // For now, let's just show empty or "Configured" status if we had that info.
                    // Actually, let's just fetch from a new endpoint if we really needed to,
                    // but usually we don't send back sensitive keys.
                    // Let's rely on user inputting new keys to update.
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
        'Make.com': point.make.cost,
        'Azure OCR': point.azure.cost,
        'OpenAI': point.openai.cost,
    }));

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
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="card">
                    <div className="card-title">
                        <h3>Make.com</h3>
                        <Zap size={20} color="#6366f1" />
                    </div>
                    <div className="usage-value">
                        {summary?.summary?.make?.eventCount || 0}
                        <span className="usage-unit">events</span>
                    </div>
                    <div className="cost-display">
                        <Euro size={18} />
                        <span>{summary?.summary?.make?.totalCost || '0.00'} EUR</span>
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
                        {summary?.totals?.cost || '0.00'}
                        <span className="usage-unit">EUR</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                        {summary?.totals?.events || 0} total events in {period}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="chart-section">
                <h3 style={{ marginBottom: '1.5rem' }}>Cost Over Time</h3>
                <div style={{ height: 400 }}>
                    <ResponsiveContainer>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" unit="€" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--glass-border)',
                                }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="Make.com" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                            <Area type="monotone" dataKey="Azure OCR" stroke="#ec4899" fill="#ec4899" fillOpacity={0.1} />
                            <Area type="monotone" dataKey="OpenAI" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

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
      `}</style>
        </div>
    );
}


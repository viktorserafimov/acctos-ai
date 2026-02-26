import React, { useState } from 'react';
import { CheckCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ISSUE_OPTIONS = [
    { value: 'system_not_working', label: 'System not working' },
    { value: 'files_issues', label: 'Files issues - missing files, incorrect data, etc.' },
    { value: 'general_support', label: 'General support' },
    { value: 'downgrade_cancel', label: 'Downgrade/Cancel subscription' },
];

const WEBHOOK_URL = 'https://hook.eu2.make.com/gjavitgyfytqz3qmg97qz3lzp59p1a1q';

export default function Tickets() {
    const { user, activeTenant } = useAuth();
    const [selectedIssue, setSelectedIssue] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const selectedLabel = ISSUE_OPTIONS.find(o => o.value === selectedIssue)?.label || '-';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);

        const now = new Date();

        const payload = {
            Issue: selectedLabel,
            Description: description.trim() || '-',
            Date: now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            SubmittedAt: now.toISOString(),
            User: user?.email || '-',
            Tenant: activeTenant?.name || '-',
        };

        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            setSubmitted(true);
        } catch (error) {
            console.error('Failed to submit support request:', error);
            setSubmitError('Failed to send your request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setSelectedIssue('');
        setDescription('');
        setSubmitted(false);
        setSubmitError(null);
    };

    return (
        <div className="support-page">
            <div className="support-header">
                <div>
                    <h2>Support</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Get help from our support team
                    </p>
                </div>
            </div>

            <div className="support-card">
                {submitted ? (
                    <div className="success-state">
                        <CheckCircle size={52} color="#10b981" />
                        <h3>Request Submitted!</h3>
                        <p>Our support team will review your request and get back to you shortly.</p>
                        <button className="btn-primary" onClick={handleReset}>
                            Submit Another Request
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">
                                <HelpCircle size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                                Please choose what you need assistance with
                            </label>
                            <select
                                className="form-select"
                                value={selectedIssue}
                                onChange={(e) => {
                                    setSelectedIssue(e.target.value);
                                    setSubmitError(null);
                                }}
                            >
                                <option value="">— Select an option —</option>
                                {ISSUE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {selectedIssue && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">
                                        Description
                                        <span className="form-label-hint"> (optional)</span>
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe your issue in more detail..."
                                        rows={5}
                                    />
                                </div>

                                {submitError && (
                                    <div className="error-banner">
                                        {submitError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn-primary btn-submit"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </>
                        )}
                    </form>
                )}
            </div>

            <style>{`
        .support-page {
          max-width: 680px;
        }
        .support-header {
          margin-bottom: 2rem;
        }
        .support-header h2 {
          font-size: 1.75rem;
        }
        .support-card {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2.5rem;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .form-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.6rem;
          color: var(--text);
        }
        .form-label-hint {
          font-weight: 400;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .form-select {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text);
          font-size: 0.95rem;
          cursor: pointer;
          transition: border-color 0.2s;
          appearance: auto;
        }
        .form-select:focus {
          outline: none;
          border-color: var(--primary);
        }
        .form-select option {
          background: #1e293b;
          color: var(--text);
        }
        .form-textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text);
          font-size: 0.95rem;
          resize: vertical;
          font-family: inherit;
          line-height: 1.6;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .form-textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .form-textarea::placeholder {
          color: var(--text-muted);
        }
        .error-banner {
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.75rem;
          color: #ef4444;
          font-size: 0.9rem;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.5rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-submit {
          margin-top: 0.5rem;
        }
        .success-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem 1rem;
          gap: 1rem;
        }
        .success-state h3 {
          font-size: 1.4rem;
          color: var(--text);
        }
        .success-state p {
          color: var(--text-muted);
          max-width: 360px;
          line-height: 1.6;
        }
      `}</style>
        </div>
    );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, ArrowRight, CheckCircle, Building2, Mail } from 'lucide-react';

export default function LandingPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, register } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
                navigate('/dashboard');
            } else {
                await register(email, password, name, tenantName);
                setSuccess('Registration successful! Please log in.');
                setIsLogin(true);
                setEmail('');
                setPassword('');
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.response?.data?.error || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="landing-hero">
                    <div className="brand-badge">Document Intelligence Platform</div>
                    <h1>Acctos AI</h1>
                    <p>Your complete dashboard for document processing usage, billing, and support.</p>

                    <div className="feature-list">
                        <div className="feature-item">
                            <CheckCircle size={18} color="var(--primary)" />
                            <span>Real-time usage monitoring</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={18} color="var(--primary)" />
                            <span>Multi-tenant organization support</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={18} color="var(--primary)" />
                            <span>Integrated billing & support</span>
                        </div>
                    </div>
                </div>

                <div className="auth-card">
                    <div className="auth-header">
                        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>{isLogin ? 'Sign in to access your dashboard' : 'Sign up to start tracking your usage'}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="alert alert-danger">{error}</div>}
                        {success && <div className="alert alert-success">{success}</div>}

                        {!isLogin && (
                            <>
                                <div className="input-group">
                                    <label>Your Name</label>
                                    <div className="input-wrapper">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder="John Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required={!isLogin}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Organization Name</label>
                                    <div className="input-wrapper">
                                        <Building2 size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder="Acme Corp"
                                            value={tenantName}
                                            onChange={(e) => setTenantName(e.target.value)}
                                            required={!isLogin}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="input-group">
                            <label>Email</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                            <ArrowRight size={18} />
                        </button>

                        <div className="auth-footer">
                            <p>
                                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                                <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="btn-link">
                                    {isLogin ? 'Create one now' : 'Sign in instead'}
                                </button>
                            </p>
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
        .landing-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .landing-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          max-width: 1100px;
          width: 100%;
          align-items: center;
        }
        .landing-hero h1 {
          font-size: 3.5rem;
          line-height: 1.1;
          margin: 1.5rem 0;
          background: linear-gradient(to right, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-hero p {
          font-size: 1.1rem;
          color: var(--text-muted);
          margin-bottom: 2rem;
        }
        .brand-badge {
          display: inline-block;
          padding: 0.4rem 1rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid var(--primary);
          color: var(--primary);
          border-radius: 2rem;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          color: var(--text);
          font-weight: 500;
        }
        .auth-card {
          background: var(--surface);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 2rem;
          padding: 3rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .auth-header h2 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .auth-header p {
          color: var(--text-muted);
          margin-bottom: 2rem;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .input-group label {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
        }
        .input-wrapper {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .input-wrapper input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.8rem;
          padding: 0.8rem 1rem 0.8rem 3rem;
          color: white;
          outline: none;
          transition: border-color 0.3s;
        }
        .input-wrapper input:focus {
          border-color: var(--primary);
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          border: none;
          border-radius: 0.8rem;
          padding: 1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.8rem;
          cursor: pointer;
          transition: opacity 0.3s, transform 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
          transform: scale(1.02);
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .auth-footer {
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .btn-link {
          background: none;
          border: none;
          color: var(--primary);
          font-weight: 600;
          margin-left: 0.5rem;
          cursor: pointer;
        }
        .alert {
          padding: 0.8rem;
          border-radius: 0.6rem;
          font-size: 0.85rem;
        }
        .alert-danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .alert-success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        @media (max-width: 900px) {
          .landing-content {
            grid-template-columns: 1fr;
            gap: 3rem;
          }
          .landing-hero {
            text-align: center;
          }
        }
      `}</style>
        </div>
    );
}

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    CreditCard,
    HelpCircle,
    LogOut,
    ChevronDown,
    Building2,
    User as UserIcon,
} from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { user, tenants, activeTenant, logout, switchTenant } = useAuth();
    const [showTenantMenu, setShowTenantMenu] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleTenantSwitch = async (tenantId: string) => {
        await switchTenant(tenantId);
        setShowTenantMenu(false);
        window.location.reload(); // Refresh to load new tenant data
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <div className="brand">
                    <h1>Acctos AI</h1>
                    <p>Client Dashboard</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Tenant Switcher */}
                    {tenants.length > 1 && (
                        <div className="tenant-switcher">
                            <button
                                className="tenant-btn"
                                onClick={() => setShowTenantMenu(!showTenantMenu)}
                            >
                                <Building2 size={16} />
                                <span>{activeTenant?.name || 'Select Tenant'}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showTenantMenu && (
                                <div className="tenant-menu">
                                    {tenants.map((tenant) => (
                                        <button
                                            key={tenant.id}
                                            className={`tenant-option ${tenant.id === activeTenant?.id ? 'active' : ''}`}
                                            onClick={() => handleTenantSwitch(tenant.id)}
                                        >
                                            <Building2 size={14} />
                                            <span>{tenant.name}</span>
                                            <span className="role-badge">{tenant.role}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* User Badge */}
                    <div className="user-badge">
                        <UserIcon size={14} />
                        <span>{user?.name || user?.email}</span>
                    </div>

                    {/* Logout */}
                    <button className="card btn-icon logout-btn" onClick={handleLogout} title="Logout">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div className="main-layout">
                {/* Sidebar Navigation */}
                <nav className="sidebar">
                    <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        <span>Usage</span>
                    </NavLink>
                    <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Billing</span>
                    </NavLink>
                    <NavLink to="/tickets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <HelpCircle size={20} />
                        <span>Support</span>
                    </NavLink>
                </nav>

                {/* Content */}
                <main className="main-content">
                    {children}
                </main>
            </div>

            <style>{`
        .main-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .sidebar {
          width: 200px;
          background: var(--surface);
          border-right: 1px solid var(--glass-border);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          color: var(--text-muted);
          text-decoration: none;
          transition: all 0.2s;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
        }
        .nav-item.active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.1));
          color: var(--primary);
        }
        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }
        .tenant-switcher {
          position: relative;
        }
        .tenant-btn {
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
        .tenant-btn:hover {
          border-color: var(--primary);
        }
        .tenant-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          min-width: 200px;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          padding: 0.5rem;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .tenant-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          background: none;
          border: none;
          border-radius: 0.5rem;
          color: var(--text-muted);
          cursor: pointer;
          text-align: left;
        }
        .tenant-option:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
        }
        .tenant-option.active {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
        }
        .role-badge {
          margin-left: auto;
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.25rem;
          text-transform: uppercase;
        }
        .user-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.8rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid var(--primary);
          border-radius: 1rem;
          font-size: 0.8rem;
          color: var(--primary);
          font-weight: 600;
        }
        .btn-icon {
          padding: 0.8rem;
          margin-bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 1rem;
        }
        .logout-btn {
          color: var(--danger);
        }
      `}</style>
        </div>
    );
}

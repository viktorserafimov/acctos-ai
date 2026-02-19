import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, X, Shield, User as UserIcon } from 'lucide-react';

interface UserEntry {
    id: string;
    email: string;
    name: string | null;
    role: string;
    membershipId: string;
    createdAt: string;
}

function displayRole(role: string): string {
    if (role === 'ORG_OWNER' || role === 'ADMIN') return 'Admin';
    return 'User';
}

export default function Users() {
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formEmail, setFormEmail] = useState('');
    const [formName, setFormName] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/v1/users');
            setUsers(response.data.users);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError(null);

        try {
            await axios.post('/v1/users', {
                email: formEmail,
                password: formPassword,
                name: formName || undefined,
                role: formRole,
            });
            setShowCreateForm(false);
            setFormEmail('');
            setFormName('');
            setFormPassword('');
            setFormRole('MEMBER');
            await fetchUsers();
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to create user';
            setError(msg);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (membershipId: string, email: string) => {
        if (!confirm(`Remove ${email} from this tenant?`)) return;

        try {
            await axios.delete(`/v1/users/${membershipId}`);
            await fetchUsers();
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || 'Failed to remove user';
            alert(msg);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading users...</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Users Management</h2>
                <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                    <UserPlus size={16} />
                    Create User
                </button>
            </div>

            {/* Users Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Role</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.membershipId} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={tdStyle}>{u.name || '-'}</td>
                                <td style={tdStyle}>{u.email}</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '1rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: (u.role === 'ORG_OWNER' || u.role === 'ADMIN')
                                            ? 'rgba(99, 102, 241, 0.15)'
                                            : 'rgba(255, 255, 255, 0.08)',
                                        color: (u.role === 'ORG_OWNER' || u.role === 'ADMIN')
                                            ? '#6366f1'
                                            : 'var(--text-muted)',
                                    }}>
                                        {(u.role === 'ORG_OWNER' || u.role === 'ADMIN')
                                            ? <Shield size={12} />
                                            : <UserIcon size={12} />}
                                        {displayRole(u.role)}
                                    </span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleDelete(u.membershipId, u.email)}
                                        title="Remove user"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--danger)',
                                            cursor: 'pointer',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No users found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showCreateForm && (
                <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>Create User</h3>
                            <button onClick={() => setShowCreateForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    value={formEmail}
                                    onChange={(e) => setFormEmail(e.target.value)}
                                    required
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password *</label>
                                <input
                                    type="password"
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                            <div className="form-group">
                                <label>Role *</label>
                                <select value={formRole} onChange={(e) => setFormRole(e.target.value as 'ADMIN' | 'MEMBER')}>
                                    <option value="MEMBER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" disabled={creating} style={{ flex: 1 }}>
                                    {creating ? 'Creating...' : 'Create User'}
                                </button>
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '1rem 1.25rem',
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
    padding: '0.85rem 1.25rem',
    color: 'var(--text)',
    fontSize: '0.95rem',
};

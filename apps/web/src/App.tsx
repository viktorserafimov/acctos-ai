import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Tickets from './pages/Tickets';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function AppRoutes() {
    const { token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/"
                element={token ? <Navigate to="/dashboard" replace /> : <LandingPage />}
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/billing"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Billing />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tickets"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Tickets />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tickets/:id"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Tickets />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;

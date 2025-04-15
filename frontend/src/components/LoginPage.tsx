// frontend/src/components/LoginPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:5001/api/auth/login', {
                email,
                password
            });
            
            await login(response.data.token, response.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', display: 'flex', padding: '0 1rem' }}>
            <div className="auth-card" style={{ maxWidth: 420, width: '100%', margin: '0 auto', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-xl)', background: 'var(--card-bg)', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="card-header text-center border-bottom-0 bg-transparent pt-4" style={{ marginBottom: '2rem' }}>
                    <h1 className="text-2xl font-semibold mb-1" style={{ fontSize: '2rem', marginBottom: 8 }}>Welcome Back</h1>
                    <p className="text-muted" style={{ color: 'var(--text-secondary)' }}>Sign in to your account</p>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-control focus-ring"
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label htmlFor="password" className="form-label">Password</label>
                                <Link to="/forgot-password" className="text-sm hover-underline" style={{ color: 'var(--primary-color)' }}>
                                    Forgot Password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-control focus-ring"
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                        </div>
                        {error && (
                            <div className="error-message alert alert-error" style={{ fontSize: '0.9rem', marginBottom: 16, padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={isLoading}
                            style={{ padding: 'var(--spacing-md)', fontSize: '1rem', width: '100%', marginTop: 12 }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner" style={{ width: '1rem', height: '1rem', marginRight: 'var(--spacing-xs)', border: '2px solid rgba(255, 255, 255, 0.3)', borderTopColor: 'white', display: 'inline-block' }}></div>
                                    Signing in...
                                </>
                            ) : 'Sign in'}
                        </button>
                        <p className="text-center text-muted mt-4" style={{ marginTop: 24, color: 'var(--text-secondary)', margin: 0 }}>
                            Don't have an account?{' '}
                            <Link to="/register" className="link-primary hover-underline" style={{ color: 'var(--primary-color)', fontWeight: 500 }}>
                                Create one now
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
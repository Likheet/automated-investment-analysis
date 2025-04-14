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
            // Make the API call ourselves to get both token and user data
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
        <div className="auth-container">
            <div className="auth-card">
                <div className="card-header text-center border-bottom-0 bg-transparent pt-4">
                    <h1 className="text-2xl font-semibold mb-1">Welcome Back</h1>
                    <p className="text-muted">Sign in to your account</p>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            <div className="flex justify-between items-center mb-1">
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
                            <div className="error-message" style={{marginBottom: 'var(--spacing-lg)'}}>
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={isLoading}
                            style={{ padding: 'var(--spacing-md)', fontSize: '1rem', position: 'relative', overflow: 'hidden' }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner" style={{ width: '1rem', height: '1rem', marginRight: 'var(--spacing-xs)', border: '2px solid rgba(255, 255, 255, 0.3)', borderTopColor: 'white', display: 'inline-block' }}></div>
                                    Signing in...
                                </>
                            ) : 'Sign in'}
                        </button>
                        <p className="text-center text-muted mt-4">
                            Don't have an account?{' '}
                            <Link to="/register" className="link-primary hover-underline" style={{ color: 'var(--primary-color)' }}>
                                Create one now
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
            <div className="auth-banner">
                <h2>Analyze Investment Reports with AI</h2>
                <p>Upload financial reports and get instant analysis to make smarter investment decisions.</p>
                <div className="auth-banner-decoration">
                    <div className="decoration-circle"></div>
                    <div className="decoration-square"></div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
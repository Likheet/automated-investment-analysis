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

    // Function to handle Google Sign-In
    const handleGoogleSignIn = () => {
        window.location.href = 'http://localhost:5001/api/auth/google';
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

                        <div className="divider" style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                            <div className="line" style={{ flexGrow: 1, height: '1px', background: 'var(--border-color)' }}></div>
                            <span style={{ padding: '0 10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>OR</span>
                            <div className="line" style={{ flexGrow: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        </div>

                        <button 
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="btn btn-outline w-full"
                            style={{ 
                                padding: 'var(--spacing-md)', 
                                fontSize: '1rem', 
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                border: '1px solid var(--border-color)',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                marginBottom: '20px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                            </svg>
                            Sign in with Google
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
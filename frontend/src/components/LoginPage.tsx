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
        <div className="flex items-center justify-center min-h-screen bg-subtle px-4">
            <div className="card" style={{
                maxWidth: '400px',
                width: '100%',
                animation: 'fadeIn 0.5s ease-out'
            }}>
                <div className="card-header text-center border-bottom-0 bg-transparent pt-4">
                    <h1 className="text-2xl font-semibold mb-1">Welcome Back</h1>
                    <p className="text-muted">Sign in to your account</p>
                </div>

                <div className="card-body">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-group">
                            <label 
                                htmlFor="email" 
                                className="form-label"
                                style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-control focus-ring"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <div className="flex justify-between items-center mb-1">
                                <label 
                                    htmlFor="password" 
                                    className="form-label"
                                    style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    Password
                                </label>
                                <Link 
                                    to="/forgot-password"
                                    className="text-sm hover-underline"
                                    style={{
                                        color: 'var(--primary-color)',
                                        textDecoration: 'none'
                                    }}
                                >
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
                            />
                        </div>

                        {error && (
                            <div 
                                className="error-message"
                                style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: 'var(--error)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.875rem',
                                    animation: 'shake 0.5s ease-in-out'
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={isLoading}
                            style={{
                                padding: 'var(--spacing-md)',
                                fontSize: '1rem',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner" style={{
                                        width: '1rem',
                                        height: '1rem',
                                        marginRight: 'var(--spacing-xs)',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        borderTopColor: 'white',
                                        display: 'inline-block'
                                    }}></div>
                                    Signing in...
                                </>
                            ) : 'Sign in'}
                        </button>

                        <p className="text-center text-muted mt-4">
                            Don't have an account?{' '}
                            <Link 
                                to="/register"
                                className="link-primary hover-underline"
                                style={{
                                    color: 'var(--primary-color)',
                                    textDecoration: 'none'
                                }}
                            >
                                Create one now
                            </Link>
                        </p>
                    </form>
                </div>
            </div>

            <style>{`
                .focus-ring:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
                }
                
                .hover-underline:hover {
                    text-decoration: underline;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .loading-spinner {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
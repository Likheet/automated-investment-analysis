// frontend/src/components/RegisterPage.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface RegisterPageProps {}

const RegisterPage: React.FC<RegisterPageProps> = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [fullName, setFullName] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!fullName.trim()) { setError('Full name is required.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters long.'); return; }
        setIsLoading(true);
        try {
            const response = await axios.post('http://localhost:5001/api/auth/register', { email, password, fullName });
            setSuccessMessage(response.data.message || 'Registration successful! Please log in.');
            setEmail(''); setPassword(''); setConfirmPassword(''); setFullName('');
        } catch (err: any) {
            if (err.response?.data?.errors) {
                const messages = err.response.data.errors.map((e: any) => e.msg).join(', ');
                setError(`Registration failed: ${messages}`);
            } else {
                setError(err.response?.data?.message || err.message || 'Registration failed.');
            }
        } finally { setIsLoading(false); }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="card-header">
                    <h2 className="text-center" style={{margin: 0}}>Create Account</h2>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="register-fullname">Full Name</label>
                            <input
                                type="text"
                                id="register-fullname"
                                className="form-control"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                disabled={isLoading}
                                placeholder="Enter your full name"
                                autoComplete="name"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="register-email">Email Address</label>
                            <input 
                                type="email" 
                                id="register-email" 
                                className="form-control" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                                disabled={isLoading}
                                placeholder="Enter your email"
                                autoComplete="email"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="register-password">Password (min 8 characters)</label>
                            <input 
                                type="password" 
                                id="register-password" 
                                className="form-control" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                disabled={isLoading}
                                placeholder="Create a password"
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="register-confirm-password">Confirm Password</label>
                            <input 
                                type="password" 
                                id="register-confirm-password" 
                                className="form-control" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                required 
                                disabled={isLoading}
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                            />
                        </div>
                        {error && (
                            <div className="error-message" style={{marginBottom: 'var(--spacing-lg)'}}>
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="success-message" style={{marginBottom: 'var(--spacing-lg)'}}>
                                {successMessage}
                            </div>
                        )}
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={isLoading} 
                            style={{width: '100%', marginBottom: 'var(--spacing-md)'}}>
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner" style={{width: '1rem', height: '1rem', borderWidth: '2px', margin: '0 var(--spacing-sm) 0 0'}}></div>
                                    Creating Account...
                                </>
                            ) : 'Create Account'}
                        </button>
                    </form>
                    <div className="text-center mt-2">
                        <p>Already have an account? <Link to="/login">Sign in</Link></p>
                    </div>
                </div>
            </div>
            <div className="auth-banner">
                <h2>Join InvestAnalyzer</h2>
                <p>Create an account to get access to our AI-powered investment analysis tools.</p>
                <div className="auth-banner-decoration">
                    <div className="decoration-line"></div>
                    <div className="decoration-dot"></div>
                    <div className="decoration-ring"></div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
// frontend/src/App.tsx
import React from 'react';
import { Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import FileUpload from './components/FileUpload';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import UserDashboard from './components/UserDashboard';
import AuthCallbackPage from './components/AuthCallbackPage';
import ThemeToggle from './components/ThemeToggle';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

// Component to protect routes that require authentication
const ProtectedRoute: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>Verifying authentication...</span>
        </div>
    );
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// Component for routes accessible only when NOT logged in
const PublicOnlyRoute: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>Verifying authentication...</span>
        </div>
    );
    return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

function AppContent(): React.ReactElement {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const location = useLocation();
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Loading application...</span>
            </div>
        );
    }

    return (
        <div className="app-container">
            <header className="header" style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--header-border)' }}>
                <div className="logo-container">
                    <span className="app-logo">KaroStartup Analyzer</span>
                </div>
                <nav className="nav-links">
                    <ThemeToggle />
                    {isAuthenticated ? (
                        <>
                            <Link to="/dashboard" className="btn nav-btn">Dashboard</Link>
                            <button onClick={logout} className="btn btn-primary nav-btn">Logout</button>
                        </>
                    ) : (
                        !isAuthPage && (
                            <>
                                <Link to="/login" className="btn nav-btn">Login</Link>
                                <Link to="/register" className="btn btn-primary nav-btn">Register</Link>
                            </>
                        )
                    )}
                </nav>
            </header>

            <main className="main-content">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />

                    {/* Auth Routes (Only when NOT logged in) */}
                    <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={
                            <div className="auth-container">
                                <div className="auth-card">
                                    <LoginPage />
                                </div>
                                <div className="auth-banner">
                                    <h2>Analyze Investment Reports with AI</h2>
                                    <p>Upload financial reports and get instant analysis to make smarter investment decisions.</p>
                                    <div className="auth-banner-decoration">
                                        <div className="decoration-circle"></div>
                                        <div className="decoration-square"></div>
                                        <div className="decoration-triangle"></div>
                                    </div>
                                </div>
                            </div>
                        } />
                        <Route path="/register" element={
                            <div className="auth-container">
                                <div className="auth-card">
                                    <RegisterPage />
                                </div>
                                <div className="auth-banner">
                                    <h2>Join KaroStartup Analyzer</h2>
                                    <p>Create an account to get access to our AI-powered investment analysis tools.</p>
                                    <div className="auth-banner-decoration">
                                        <div className="decoration-line"></div>
                                        <div className="decoration-dot"></div>
                                        <div className="decoration-ring"></div>
                                    </div>
                                </div>
                            </div>
                        } />
                    </Route>

                    {/* Google OAuth Callback Route */}
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />

                    {/* Protected Routes (Only when logged in) */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={
                            <div className="full-dashboard">
                                <div className="dashboard-header">
                                    <div className="header-content">
                                        <h1>Investment Report Analysis</h1>
                                        <p>Upload financial reports to analyze with our AI tools</p>
                                    </div>
                                    <div className="header-decoration">
                                        <div className="decoration-shape shape1"></div>
                                        <div className="decoration-shape shape2"></div>
                                        <div className="decoration-shape shape3"></div>
                                    </div>
                                </div>
                                
                                <div className="features-grid">
                                    <div className="feature-card">
                                        <div className="feature-icon">📊</div>
                                        <h3>Upload Reports</h3>
                                        <p>Upload your financial documents for AI analysis</p>
                                    </div>
                                    <div className="feature-card">
                                        <div className="feature-icon">🔍</div>
                                        <h3>Deep Analysis</h3>
                                        <p>Get comprehensive insights from your reports</p>
                                    </div>
                                    <div className="feature-card">
                                        <div className="feature-icon">📈</div>
                                        <h3>Investment Recommendations</h3>
                                        <p>Receive data-backed investment suggestions</p>
                                    </div>
                                </div>

                                <section className="upload-section card">
                                    <h2>Upload New Report</h2>
                                    <FileUpload />
                                </section>
                                
                                <section className="analysis-section card">
                                    <h2>Your Analysis History</h2>
                                    <UserDashboard />
                                </section>
                                
                                <div className="info-container">
                                    <div className="info-card">
                                        <h3>About Our Analysis</h3>
                                        <p>Our AI-powered analysis uses machine learning to extract key insights from investment reports and financial documents. We identify growth opportunities, risks, and trends to help you make informed decisions.</p>
                                    </div>
                                    <div className="info-card">
                                        <h3>How It Works</h3>
                                        <p>1. Upload your financial report<br />
                                        2. Our AI analyzes the content<br />
                                        3. Review detailed insights and recommendations<br />
                                        4. Make better investment decisions</p>
                                    </div>
                                </div>
                                
                                <div className="stats-container">
                                    <div className="stat-item">
                                        <div className="stat-number">98%</div>
                                        <div className="stat-label">Accuracy</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">5000+</div>
                                        <div className="stat-label">Reports Analyzed</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">3.5M+</div>
                                        <div className="stat-label">Data Points</div>
                                    </div>
                                </div>
                            </div>
                        } />
                    </Route>

                    {/* Fallback Route for unknown paths */}
                    <Route path="*" element={
                        <div className="not-found-container">
                            <div className="not-found-card">
                                <div className="error-code">404</div>
                                <h2>Page Not Found</h2>
                                <p>The page you are looking for doesn't exist or has been moved.</p>
                                <div className="not-found-decoration">
                                    <div className="decoration-dot-grid"></div>
                                </div>
                                <Link to="/" className="btn btn-primary">Go Home</Link>
                            </div>
                        </div>
                    } />
                </Routes>
            </main>

            <footer className="footer" style={{padding: 'var(--spacing-md)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)'}}>
                <div className="footer-container">
                    <div className="footer-info">
                        <div className="footer-logo">
                            <span className="app-logo">KaroStartup Analyzer</span>
                        </div>
                        <p>© {new Date().getFullYear()} KaroStartup Analyzer | All rights reserved</p>
                    </div>
                    <div className="footer-sections">
                        <div className="footer-section">
                            <h4>Company</h4>
                            <a href="#" className="footer-link">About Us</a>
                            <a href="#" className="footer-link">Careers</a>
                            <a href="#" className="footer-link">Contact</a>
                        </div>
                        <div className="footer-section">
                            <h4>Support</h4>
                            <a href="#" className="footer-link">Help Center</a>
                            <a href="#" className="footer-link">Privacy Policy</a>
                            <a href="#" className="footer-link">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className="footer-decoration">
                    <div className="footer-line"></div>
                </div>
            </footer>
        </div>
    );
}

function App(): React.ReactElement {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

export default App;
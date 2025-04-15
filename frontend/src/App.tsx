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
                    <span className="app-logo">InvestAnalyzer</span>
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
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
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
                                </div>
                                
                                <div className="features-grid">
                                    <div className="feature-card card">
                                        <h3>Upload Reports</h3>
                                        <p>Upload documents for analysis</p>
                                    </div>
                                    <div className="feature-card card">
                                        <h3>Analysis</h3>
                                        <p>Get insights from reports</p>
                                    </div>
                                    <div className="feature-card card">
                                        <h3>Recommendations</h3>
                                        <p>Data-backed suggestions</p>
                                    </div>
                                </div>

                                <div className="card">
                                    <h2>Upload New Report</h2>
                                    <FileUpload />
                                </div>
                                
                                <div className="card">
                                    <h2>Analysis History</h2>
                                    <UserDashboard />
                                </div>
                                
                                <div className="features-grid">
                                    <div className="card">
                                        <h3>About Our Analysis</h3>
                                        <p>AI-powered insights from financial documents to help make informed decisions.</p>
                                    </div>
                                    <div className="card">
                                        <h3>How It Works</h3>
                                        <p>1. Upload report<br />
                                        2. AI analysis<br />
                                        3. Review insights<br />
                                        4. Make decisions</p>
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
                            <span className="app-logo">InvestAnalyzer</span>
                        </div>
                        <p>© {new Date().getFullYear()} InvestAnalyzer | All rights reserved</p>
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

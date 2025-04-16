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
import { ThemeProvider, useTheme } from './context/ThemeContext';
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

// New AboutAnalysis component
const AboutAnalysis: React.FC = () => {
    const { theme } = useTheme();
    const [isVisible, setIsVisible] = React.useState(false);
    const sectionRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.2 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => {
            if (sectionRef.current) {
                observer.unobserve(sectionRef.current);
            }
        };
    }, []);

    return (
        <div ref={sectionRef} className={`about-analysis ${isVisible ? 'visible' : ''}`}>
            <div className="about-header">
                <h2>About Our Analysis</h2>
                <div className="about-tagline">
                    AI-powered insights from financial documents to help make informed decisions
                </div>
            </div>

            <div className="process-flow">
                {[
                    {
                        step: 1,
                        title: "Upload Report",
                        description: "Securely upload your pitch deck or financial document",
                        icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        )
                    },
                    {
                        step: 2,
                        title: "AI Analysis",
                        description: "Advanced algorithms extract and analyze key financial metrics",
                        icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"></path>
                            </svg>
                        )
                    },
                    {
                        step: 3,
                        title: "Review Insights",
                        description: "Get comprehensive reports with visual data representation",
                        icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <line x1="10" y1="9" x2="8" y2="9"></line>
                            </svg>
                        )
                    },
                    {
                        step: 4,
                        title: "Make Decisions",
                        description: "Use data-backed recommendations to guide your investment strategy",
                        icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        )
                    }
                ].map((item, index) => (
                    <div key={item.step} className={`process-step ${isVisible ? 'animate' : ''}`} style={{animationDelay: `${index * 0.2}s`}}>
                        <div className="step-icon">
                            <div className="step-number">{item.step}</div>
                            {item.icon}
                        </div>
                        <div className="step-content">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .about-analysis {
                    opacity: 0;
                    transform: translateY(30px);
                    transition: opacity 0.8s ease-out, transform 0.8s ease-out;
                    background: var(--card-bg);
                    padding: var(--spacing-xl) var(--spacing-xl);
                    border-radius: var(--radius-xl);
                    margin-bottom: var(--spacing-xl);
                    box-shadow: var(--shadow-md);
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                    position: relative;
                }
                
                .about-analysis.visible {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .about-analysis::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 5px;
                    background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
                }
                
                .about-header {
                    text-align: center;
                    margin-bottom: var(--spacing-xl);
                    position: relative;
                }
                
                .about-header h2 {
                    font-size: 2rem;
                    margin-bottom: var(--spacing-sm);
                    background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    display: inline-block;
                }
                
                .about-tagline {
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .process-flow {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: var(--spacing-lg);
                    margin: var(--spacing-xl) 0;
                }
                
                .process-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'};
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-lg);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    position: relative;
                    opacity: 0;
                    transform: translateY(20px);
                }
                
                .process-step.animate {
                    animation: fadeInUp 0.6s forwards ease-out;
                }
                
                .process-step:hover {
                    transform: translateY(-5px);
                    box-shadow: var(--shadow-md);
                    background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
                }
                
                .process-step::after {
                    content: '';
                    position: absolute;
                    bottom: -15px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 15px solid transparent;
                    border-right: 15px solid transparent;
                    border-top: 15px solid ${theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'};
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                .process-step:hover::after {
                    opacity: 1;
                }
                
                .step-icon {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: var(--spacing-md);
                    position: relative;
                    color: white;
                    box-shadow: 0 5px 15px rgba(var(--primary-color-rgb), 0.3);
                }
                
                .step-number {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 28px;
                    height: 28px;
                    background-color: ${theme === 'dark' ? '#1e293b' : 'white'};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 0.9rem;
                    color: var(--primary-color);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    border: 2px solid var(--primary-color);
                }
                
                .step-content {
                    flex: 1;
                }
                
                .step-content h3 {
                    font-size: 1.3rem;
                    margin-bottom: var(--spacing-sm);
                    color: var(--text-primary);
                }
                
                .step-content p {
                    color: var(--text-secondary);
                    line-height: 1.6;
                }
                
                .about-footer {
                    margin-top: var(--spacing-xl);
                    padding-top: var(--spacing-xl);
                    border-top: 1px solid var(--border-color);
                }
                
                .metrics-container {
                    display: flex;
                    justify-content: space-around;
                    flex-wrap: wrap;
                    gap: var(--spacing-lg);
                }
                
                .metric {
                    text-align: center;
                    opacity: 0;
                    transform: scale(0.9);
                }
                
                .metric.animate {
                    animation: scaleIn 0.5s forwards ease-out;
                }
                
                .metric-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    line-height: 1.1;
                }
                
                .metric-label {
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                    margin-top: var(--spacing-xs);
                }
                
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                @media (max-width: 768px) {
                    .process-flow {
                        grid-template-columns: 1fr;
                    }
                    
                    .process-step::after {
                        display: none;
                    }
                    
                    .metrics-container {
                        flex-direction: column;
                        gap: var(--spacing-md);
                    }
                    
                    .about-header h2 {
                        font-size: 1.8rem;
                    }
                    
                    .about-tagline {
                        font-size: 1rem;
                    }
                }
            `}</style>
        </div>
    );
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
                                    <h2>Upload Startup Pitch Deck</h2>
                                    <FileUpload />
                                </div>
                                
                                <div className="card">
                                    <h2>Analysis History</h2>
                                    <UserDashboard />
                                </div>
                                
                                {/* Replaced the features-grid with AboutAnalysis component */}
                                <AboutAnalysis />
                                
                                {/* Removed the stats-container since it's now part of AboutAnalysis */}
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
                <div className="footer-container" style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
                    <div className="footer-info">
                        <div className="footer-logo">
                            <span className="app-logo">InvestAnalyzer</span>
                        </div>
                        <p style={{margin: 0}}>© 2025 InvestAnalyzer | All rights reserved</p>
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

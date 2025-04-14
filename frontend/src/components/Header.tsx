import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const Header: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const {} = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    
    // Close mobile menu when changing routes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);
    
    // Handle scroll effect for sticky header
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 10) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };
        
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle dashboard click - navigate with hash for scrolling
    const handleDashboardClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (location.pathname === '/dashboard') {
            // If already on dashboard, just scroll to history section
            const historySection = document.querySelector('.dashboard-header');
            if (historySection) {
                historySection.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            // Navigate to dashboard with hash
            navigate('/dashboard#history');
        }
    }

    return (
        <header className={`header${scrolled ? ' scrolled' : ''}`} style={{
            backgroundColor: 'var(--header-bg)',
            borderBottom: '1px solid var(--header-border)',
            boxShadow: scrolled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            transition: 'all 0.3s ease',
            position: 'sticky',
            top: 0,
            zIndex: 1000
        }}>
            <div className="container flex items-center justify-between" style={{
                height: '100%',
                maxWidth: 'var(--container-width)',
                margin: '0 auto',
                padding: '0 var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%'
            }}>
                <div className="logo-container">
                    <Link to="/" className="logo-link">
                        <div className="logo-icon">
                            {/* Investment Chart Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 3v17a1 1 0 0 0 1 1h17v-2H5V3H3z"/>
                                <path d="M15.293 14.707a.999.999 0 0 0 1.414 0l5-5-1.414-1.414L16 12.586l-2.293-2.293a.999.999 0 0 0-1.414 0l-5 5 1.414 1.414L13 12.414l2.293 2.293z"/>
                                <circle cx="7.5" cy="7.5" r="1.5" />
                                <circle cx="12" cy="10" r="1.5" />
                                <circle cx="16.5" cy="7.5" r="1.5" />
                            </svg>
                            <div className="logo-circles">
                                <div className="logo-circle1"></div>
                                <div className="logo-circle2"></div>
                            </div>
                        </div>
                        <span className="logo-text-gradient">
                            <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>Invest</span>Analyzer
                        </span>
                    </Link>
                </div>
                <button 
                    className="mobile-menu-button md:hidden"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                        {isMobileMenuOpen ? (
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        ) : (
                            <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                        )}
                    </svg>
                </button>
                <nav 
                    className={`nav-links${isMobileMenuOpen ? ' mobile-menu-open' : ''}`}
                    style={{ display: isMobileMenuOpen ? 'flex' : '' }}
                >
                    <ThemeToggle />
                    {isAuthenticated ? (
                        <>
                            <Link 
                                to="/dashboard" 
                                className="nav-link"
                                onClick={handleDashboardClick}
                            >
                                Dashboard
                                {location.pathname === '/dashboard' && (
                                    <span className="nav-link-underline"></span>
                                )}
                            </Link>
                            <button 
                                onClick={logout}
                                className="btn btn-primary"
                                style={{ marginLeft: 8 }}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link 
                            to="/login"
                            className="btn btn-primary"
                            style={{ marginLeft: 8 }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                            </svg>
                            Login
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;
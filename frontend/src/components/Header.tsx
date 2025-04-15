import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import './Header.css'; // Import the external CSS file

const Header: React.FC = () => {
    const { isAuthenticated, logout, user } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { theme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Close mobile menu when changing routes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);
    
    // Handle scroll effect for sticky header
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
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
            // Navigate to dashboard and then scroll after navigation is complete
            navigate('/dashboard');
            // Use setTimeout to ensure DOM is updated after navigation
            setTimeout(() => {
                const historySection = document.querySelector('.dashboard-header');
                if (historySection) {
                    historySection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }
    }
    
    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <header className={`header${scrolled ? ' scrolled' : ''} ${theme}`}>
            <div className="container">
                <div className="logo-container">
                    <Link to="/" className="app-logo">
                        <div className="logo-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 22h20"></path>
                                <path d="M10 3L2 10l8 7"></path>
                                <path d="M14 3l8 7-8 7"></path>
                                <path d="M10 18V3"></path>
                                <path d="M14 6v15"></path>
                            </svg>
                        </div>
                        <span className="logo-text">InvestAnalyzer<span className="logo-dot">.</span></span>
                    </Link>
                </div>

                {/* Mobile menu button */}
                <button 
                    className="mobile-menu-toggle"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <div className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </button>

                {/* Navigation links */}
                <nav className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
                    {isAuthenticated ? (
                        <>
                            <Link 
                                to="/dashboard" 
                                className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                                onClick={handleDashboardClick}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                                Dashboard
                            </Link>
                            
                            {/* User dropdown */}
                            <div className="user-dropdown-container" ref={dropdownRef}>
                                <button 
                                    className={`user-dropdown-toggle ${isDropdownOpen ? 'active' : ''}`}
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <div className="avatar">
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="dropdown-arrow">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>
                                </button>
                                
                                {isDropdownOpen && (
                                    <div className="dropdown-menu">
                                        <div className="dropdown-header">
                                            <div className="avatar-lg">
                                                {user?.name?.charAt(0) || 'U'}
                                            </div>
                                            <div className="user-info">
                                                <div className="user-name">{user?.name || 'User'}</div>
                                                <div className="user-email">{user?.email || 'user@example.com'}</div>
                                            </div>
                                        </div>
                                        <div className="dropdown-divider"></div>
                                        <Link to="/dashboard" className="dropdown-item">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="7" height="7"></rect>
                                                <rect x="14" y="3" width="7" height="7"></rect>
                                                <rect x="14" y="14" width="7" height="7"></rect>
                                                <rect x="3" y="14" width="7" height="7"></rect>
                                            </svg>
                                            Dashboard
                                        </Link>
                                        <button onClick={logout} className="dropdown-item">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                                <polyline points="16 17 21 12 16 7"></polyline>
                                                <line x1="21" y1="12" x2="9" y2="12"></line>
                                            </svg>
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <ThemeToggle />
                            
                        </>
                    ) : (
                        <>
                            <ThemeToggle />
                            
                            <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 3h4a2 2 0 0 1-2 2v14a2 2 0 0 1-2 2h-4"></path>
                                    <polyline points="10 17 15 12 10 7"></polyline>
                                    <line x1="15" y1="12" x2="3" y2="12"></line>
                                </svg>
                                Login
                            </Link>
                            <Link to="/register" className="btn btn-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="8.5" cy="7" r="4"></circle>
                                    <line x1="20" y1="8" x2="20" y2="14"></line>
                                    <line x1="23" y1="11" x2="17" y2="11"></line>
                                </svg>
                                Register
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;
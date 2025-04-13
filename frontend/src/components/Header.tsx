import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const Header: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="header" style={{ 
            backgroundColor: 'var(--bg-light)',
            borderBottom: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div className="container flex items-center justify-between" style={{ height: '100%' }}>
                <div className="logo-container">
                    <Link to="/" className="logo-link" style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: 'var(--primary-color)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M0 12.5A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6.85L8.129 8.947a.5.5 0 0 1-.258 0L0 6.85v5.65z"/>
                            <path d="M0 4.5A1.5 1.5 0 0 1 1.5 3h13A1.5 1.5 0 0 1 16 4.5v1.384l-7.614 2.03a1.5 1.5 0 0 1-.772 0L0 5.884V4.5zm5-2A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V3h-1v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V3H5v-.5z"/>
                        </svg>
                        KaroStartup
                    </Link>
                </div>

                <button 
                    className="mobile-menu-button md:hidden"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{
                        padding: 'var(--spacing-xs)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                        {isMobileMenuOpen ? (
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        ) : (
                            <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                        )}
                    </svg>
                </button>

                <nav className={`nav-links ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`} style={{
                    display: isMobileMenuOpen ? 'flex' : 'none'
                }}>
                    <ThemeToggle />
                    {isAuthenticated ? (
                        <>
                            <Link 
                                to="/dashboard" 
                                className="nav-link"
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    transition: 'all var(--transition-base)'
                                }}
                            >
                                Dashboard
                            </Link>
                            <button 
                                onClick={logout}
                                className="btn btn-primary"
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                                    fontWeight: '500'
                                }}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link 
                            to="/login"
                            className="btn btn-primary"
                            style={{
                                padding: 'var(--spacing-sm) var(--spacing-lg)',
                                fontWeight: '500'
                            }}
                        >
                            Login
                        </Link>
                    )}
                </nav>
            </div>

            <style>{`
                @media (max-width: 767px) {
                    .nav-links {
                        position: absolute;
                        top: var(--header-height);
                        left: 0;
                        right: 0;
                        background-color: var(--bg-light);
                        padding: var(--spacing-md);
                        flex-direction: column;
                        gap: var(--spacing-md);
                        border-bottom: 1px solid var(--border-light);
                        box-shadow: var(--shadow-md);
                    }

                    .nav-links.mobile-menu-open {
                        display: flex;
                    }
                }

                @media (min-width: 768px) {
                    .mobile-menu-button {
                        display: none;
                    }

                    .nav-links {
                        display: flex !important;
                        position: static;
                        padding: 0;
                        flex-direction: row;
                        gap: var(--spacing-md);
                        align-items: center;
                        background: none;
                        border: none;
                        box-shadow: none;
                    }
                }
            `}</style>
        </header>
    );
};

export default Header;
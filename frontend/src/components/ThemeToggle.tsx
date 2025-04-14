import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle the animation state
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const handleToggle = () => {
    setIsAnimating(true);
    toggleTheme();
  };

  return (
    <button
      onClick={handleToggle}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="theme-toggle-button btn"
      style={{
        border: `1px solid var(--border-color)`,
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        color: theme === 'light' ? 'var(--text-secondary)' : 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        background: 'var(--bg-primary)',
        transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}
    >
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s ease',
        transform: theme === 'light' ? 'translateY(0) rotate(0)' : 'translateY(-100%) rotate(-45deg)',
        opacity: theme === 'light' ? 1 : 0
      }}>
        {/* Moon icon for dark mode */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </div>
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s ease',
        transform: theme === 'light' ? 'translateY(100%) rotate(45deg)' : 'translateY(0) rotate(0)',
        opacity: theme === 'light' ? 0 : 1
      }}>
        {/* Sun icon for light mode */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </div>
      
      {/* Background transition effect */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        backgroundColor: theme === 'light' ? 'rgba(var(--primary-color-rgb), 0.05)' : 'rgba(var(--primary-color-rgb), 0.1)',
        opacity: isAnimating ? 1 : 0,
        transform: isAnimating ? 'scale(1)' : 'scale(0)',
        transition: 'transform 0.4s ease, opacity 0.4s ease',
        zIndex: -1
      }} />
    </button>
  );
};

export default ThemeToggle;
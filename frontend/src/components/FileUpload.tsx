import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProgressBar from './ProgressBar'; // Import the standalone ProgressBar component

type MessageType = 'success' | 'error' | 'info';

// Declare window interface to include our global function
declare global {
  interface Window {
    handleAnalysisComplete?: (id: number) => void;
  }
}

// Define styles as properly typed CSS-in-JS objects
const styles = {
  uploadContainer: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
  } as CSSProperties,
  
  uploadCard: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-md)',
    padding: 'var(--spacing-xl)',
    marginBottom: 'var(--spacing-xl)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
    position: 'relative' as const,
    transformStyle: 'preserve-3d' as const,
    willChange: 'transform',
    transition: 'transform 0.5s var(--transition-bounce), box-shadow 0.3s ease, border-color 0.3s ease'
  } as CSSProperties,
  
  uploadHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-lg)',
    position: 'relative' as const
  } as CSSProperties,
  
  uploadIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
    color: 'white',
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    flexShrink: 0,
    boxShadow: '0 5px 15px -5px rgba(var(--primary-color-rgb), 0.4)'
  } as CSSProperties,
  
  uploadHeaderTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    position: 'relative' as const,
    paddingBottom: 'var(--spacing-xs)'
  } as CSSProperties,
  
  uploadDescription: {
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-xl)',
    fontSize: '1rem',
    lineHeight: 1.6,
    position: 'relative' as const,
    zIndex: 1
  } as CSSProperties,
  
  progressContainer: {
    marginBottom: 'var(--spacing-xl)',
  } as CSSProperties,
  
  dropZone: (isDragging: boolean, isDisabled: boolean, theme: string): CSSProperties => ({
    border: '2px dashed var(--border-color)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-2xl) var(--spacing-xl)',
    textAlign: 'center' as const,
    cursor: isDisabled ? 'default' : 'pointer',
    marginBottom: 'var(--spacing-xl)',
    backgroundColor: isDragging 
      ? `rgba(var(--primary-color-rgb), ${theme === 'dark' ? '0.1' : '0.05'})` 
      : 'var(--card-bg)',
    transition: 'all 0.3s var(--transition-bounce)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    overflow: 'hidden',
    minHeight: '250px',
    borderColor: isDragging ? 'var(--primary-color)' : 'var(--border-color)',
    opacity: isDisabled ? 0.6 : 1,
    transform: isDragging ? 'scale(0.99)' : 'scale(1)',
    boxShadow: isDragging ? '0 10px 25px -5px rgba(var(--primary-color-rgb), 0.1)' : 'none'
  }),
  
  dropZoneBefore: (isDragging: boolean): CSSProperties => ({
    content: '""',
    position: 'absolute' as const,
    inset: '0',
    background: `radial-gradient(circle at center, rgba(var(--primary-color-rgb), ${isDragging ? '0.1' : '0'}), transparent 60%)`,
    opacity: isDragging ? 1 : 0,
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none' as const
  }),
  
  dropIcon: (isDragging: boolean): CSSProperties => ({
    width: '80px',
    height: '80px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: isDragging
      ? 'rgba(var(--primary-color-rgb), 0.2)'
      : 'var(--bg-secondary)',
    margin: '0 auto var(--spacing-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s var(--transition-bounce)',
    color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)',
    transform: isDragging ? 'translateY(-5px) scale(1.1)' : 'none',
    boxShadow: isDragging ? '0 10px 20px -5px rgba(var(--primary-color-rgb), 0.2)' : 'none'
  }),
  
  dropTitle: (isDragging: boolean): CSSProperties => ({
    color: isDragging ? 'var(--primary-color)' : 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    fontWeight: 600,
    fontSize: '1.25rem',
    transition: 'color 0.3s ease, transform 0.3s ease',
    transform: isDragging ? 'translateY(-2px)' : 'none'
  }),

  dropDescription: {
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-md)',
    transition: 'transform 0.3s ease'
  } as CSSProperties,
  
  browseText: {
    color: 'var(--primary-color)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative' as const,
    display: 'inline-block',
    paddingBottom: '2px'
  } as CSSProperties,

  browseTextAfter: {
    content: '""',
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    width: '100%',
    height: '2px',
    background: 'var(--primary-color)',
    transform: 'scaleX(0)',
    transformOrigin: 'right',
    transition: 'transform 0.3s ease'
  } as CSSProperties,
  
  fileSpecs: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    maxWidth: '400px',
    margin: '0 auto',
    lineHeight: 1.5,
  } as CSSProperties,
  
  selectedFile: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    backgroundColor: 'var(--card-bg)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 'var(--spacing-lg)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.3s ease, transform 0.4s var(--transition-bounce)',
    position: 'relative' as const,
    overflow: 'hidden',
    transform: 'translateY(0)'
  }),
  
  fileIcon: {
    minWidth: '48px',
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    flexShrink: 0,
    boxShadow: '0 5px 15px -5px rgba(var(--primary-color-rgb), 0.3)'
  } as CSSProperties,
  
  fileDetails: {
    flex: 1,
    overflow: 'hidden',
  } as CSSProperties,
  
  fileName: {
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSProperties,
  
  fileSize: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  
  fileRemoveBtn: (): CSSProperties => ({
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    width: '36px',
    height: '36px',
    minWidth: '36px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    flexShrink: 0
  }),
  
  uploadButton: (isDisabled: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    fontWeight: 600,
    width: '100%',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    background: isDisabled 
      ? 'linear-gradient(45deg, rgba(var(--primary-color-rgb), 0.6), rgba(var(--accent-color-rgb), 0.6))'
      : 'linear-gradient(45deg, var(--primary-color), var(--accent-color))',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s var(--transition-bounce)',
    position: 'relative' as const,
    overflow: 'hidden',
    opacity: isDisabled ? 0.8 : 1,
    boxShadow: isDisabled 
      ? 'none' 
      : '0 10px 25px -10px rgba(var(--primary-color-rgb), 0.5)'
  }),

  buttonAfter: {
    content: '""',
    position: 'absolute' as const,
    top: '-50%',
    right: '-50%',
    bottom: '-50%',
    left: '-50%',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 100%)',
    transform: 'rotateZ(60deg) translate(-5em, 7.5em)',
    opacity: 0,
    transition: 'opacity 0.3s, transform 0.3s'
  } as CSSProperties,
  
  loadingSpinner: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    position: 'relative' as const,
    animation: 'spinner-ring 1s linear infinite'
  } as CSSProperties,
  
  message: (type: MessageType): CSSProperties => ({
    marginTop: 'var(--spacing-xl)',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-sm)',
    backgroundColor:
      type === 'success'
        ? 'var(--success-bg, rgba(16, 185, 129, 0.1))'
        : type === 'error'
        ? 'var(--error-bg, rgba(239, 68, 68, 0.1))'
        : 'var(--info-bg, rgba(59, 130, 246, 0.1))',
    borderLeft: `4px solid ${
      type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--info)'
    }`,
    color: type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--info)',
    animation: 'slide-up 0.4s ease-out forwards'
  }),
  
  messageIcon: {
    marginTop: '2px',
    flexShrink: 0,
  } as CSSProperties,
  
  messageContent: {
    whiteSpace: 'pre-line',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  } as CSSProperties,
  
  // Add keyframes style to be added via regular style tag
  keyframes: `
    @keyframes spinner-ring {
      0% {
        box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
      }
      5%, 95% {
        box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
      }
      10%, 59% {
        box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em, -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
      }
      20% {
        box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em, -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
      }
      38% {
        box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em, -0.82em -0.09em 0 -0.477em;
      }
      100% {
        box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em;
      }
    }
    
    @keyframes slide-up {
      0% { 
        opacity: 0;
        transform: translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse-border {
      0% { 
        box-shadow: 0 0 0 0 rgba(var(--primary-color-rgb), 0.4);
      }
      70% { 
        box-shadow: 0 0 0 10px rgba(var(--primary-color-rgb), 0);
      }
      100% { 
        box-shadow: 0 0 0 0 rgba(var(--primary-color-rgb), 0);
      }
    }
    
    @media (max-width: 768px) {
      .upload-card {
        padding: var(--spacing-lg);
      }
      
      .drop-zone {
        padding: var(--spacing-xl) var(--spacing-md);
      }
    }
  `
};

const FileUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const { token } = useAuth();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const browseTextRef = useRef<HTMLSpanElement>(null);

  // Refs for the parallax effect
  const cardRef = useRef<HTMLDivElement>(null);
  const [parallaxValues, setParallaxValues] = useState({ x: 0, y: 0 });

  // Progress tracking state
  const [analysisId, setAnalysisId] = useState<number | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function implementations
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isLoading) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const triggerFileInput = () => {
    if (!isLoading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Check file type
    const validTypes = [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (!validTypes.includes(file.type) && 
        !file.name.endsWith('.ppt') && 
        !file.name.endsWith('.pptx')) {
      setMessage('Please upload a PowerPoint file (.ppt or .pptx)');
      setMessageType('error');
      return;
    }
    
    // Check file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      setMessage('File is too large. Maximum size is 50MB');
      setMessageType('error');
      return;
    }
    
    setSelectedFile(file);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setIsLoading(true);
    setMessage('');
    // Show progress immediately with initial status
    setAnalysisStatus('UPLOADING_DECK');
    setShowProgress(true);

    // Create form data
    const formData = new FormData();
    formData.append('pitchDeck', selectedFile);

    try {
      const response = await axios.post('/api/analysis/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data && response.data.analysisId) {
        setAnalysisId(response.data.analysisId);
        // Start polling immediately
        startPolling(response.data.analysisId);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Upload error:', error);

      // Provide more specific error messages
      if (axios.isAxiosError(error)) {
        if (error.response) {
          setMessage(`Upload failed: ${error.response.data.message || 'Server error'}`);
        } else if (error.request) {
          setMessage('Upload failed: No response from server. Please check your network connection.');
        } else {
          setMessage(`Upload failed: ${error.message}`);
        }
      } else {
        setMessage('An unexpected error occurred. Please try again.');
      }

      setMessageType('error');
      setIsLoading(false);
      setShowProgress(false);
    }
  };

  const startPolling = (id: number) => {
    // Poll for status updates frequently (every 1.2 seconds)
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await axios.get(`/api/analysis/status/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const { status } = response.data;
        
        // Only update if status has changed to avoid unnecessary re-renders
        if (status !== analysisStatus) {
          console.log(`Status updated: ${analysisStatus || 'null'} → ${status}`);
          setAnalysisStatus(status);
        }
        
        // Convert to uppercase for comparison since backend uses uppercase status values
        const upperStatus = status?.toUpperCase();
        if (upperStatus === 'COMPLETED' || upperStatus === 'FAILED') {
          console.log(`Analysis ${upperStatus} - stopping polling`);
          stopPolling();
          // Keep isLoading true for a short period to let progress bar finish animations
          setTimeout(() => {
            setIsLoading(false);
          }, 2000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        stopPolling();
        setIsLoading(false);
        setShowProgress(false);
        setMessage('Error processing your file. Please try again.');
        setMessageType('error');
      }
    }, 1200); // Reduced from 1500ms to 1200ms for more responsive updates
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleProgressComplete = () => {
    // Hide the progress bar UI
    setShowProgress(false);
    
    // Reset the file and analysis state
    setSelectedFile(null);
    
    // Call global handler in UserDashboard to reload and highlight the new report
    if (analysisId && window.handleAnalysisComplete) {
      // Call the global handler to refresh history and highlight the new row
      window.handleAnalysisComplete(analysisId);
    }
    
    // Reset analysis state
    setAnalysisId(null);
    setAnalysisStatus(null);
    
    // Show success message
    setMessage('Analysis completed successfully! View the results in your Analysis History below.');
    setMessageType('success');
  };

  // Clear polling when component unmounts
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Parallax effect for card
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate distance from center in percentage (-50 to 50)
      const x = ((e.clientX - centerX) / rect.width) * 20;
      const y = ((e.clientY - centerY) / rect.height) * 20;

      setParallaxValues({ x, y });
    };

    const handleMouseLeave = () => {
      // Reset the transform when mouse leaves
      setParallaxValues({ x: 0, y: 0 });
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Effect for browse text hover animation
  useEffect(() => {
    const browseText = browseTextRef.current;
    if (!browseText) return;
    
    const handleMouseEnter = () => {
      if (browseText.style) {
        browseText.style.color = 'var(--accent-color)';
        if (browseText.querySelector('.browse-underline')) {
          (browseText.querySelector('.browse-underline') as HTMLElement).style.transform = 'scaleX(1)';
          (browseText.querySelector('.browse-underline') as HTMLElement).style.transformOrigin = 'left';
        }
      }
    };
    
    const handleMouseLeave = () => {
      if (browseText.style) {
        browseText.style.color = 'var(--primary-color)';
        if (browseText.querySelector('.browse-underline')) {
          (browseText.querySelector('.browse-underline') as HTMLElement).style.transform = 'scaleX(0)';
          (browseText.querySelector('.browse-underline') as HTMLElement).style.transformOrigin = 'right';
        }
      }
    };
    
    browseText.addEventListener('mouseenter', handleMouseEnter);
    browseText.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      browseText.removeEventListener('mouseenter', handleMouseEnter);
      browseText.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Calculate dynamic styles for parallax effect
  const cardStyle: CSSProperties = {
    ...styles.uploadCard,
    transform: `perspective(1000px) rotateX(${-parallaxValues.y * 0.2}deg) rotateY(${parallaxValues.x * 0.2}deg) scale3d(1, 1, 1)`,
    transition: parallaxValues.x === 0 && parallaxValues.y === 0 ? 'all 0.5s ease-out' : 'none',
    borderColor: isHovering ? 'rgba(var(--primary-color-rgb), 0.3)' : 'var(--border-color)',
    boxShadow: isHovering ? 'var(--shadow-lg)' : 'var(--shadow-md)'
  };

  return (
    <div style={styles.uploadContainer}>
      {/* Add keyframes for animations */}
      <style>{styles.keyframes}</style>
      
      <div 
        ref={cardRef} 
        style={cardStyle}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div style={styles.uploadHeader}>
          <div style={styles.uploadIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h2 style={styles.uploadHeaderTitle}>
            Upload Pitch Deck for Analysis
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              width: '40px',
              height: '3px',
              background: 'var(--primary-color)',
              borderRadius: '2px'
            }}></div>
          </h2>
        </div>
        
        {!showProgress && !isLoading && (
          <p style={styles.uploadDescription}>
            Upload your presentation to get an AI-powered investment analysis report, including risk assessment, market potential, and investment recommendations.
          </p>
        )}
        
        {showProgress && (
          <div style={styles.progressContainer}>
            <ProgressBar 
              status={analysisStatus} 
              analysisId={analysisId}
              onComplete={handleProgressComplete}
            />
          </div>
        )}
        
        {!showProgress && (
          <div 
            style={styles.dropZone(isDragging, isLoading, theme)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <div style={styles.dropZoneBefore(isDragging)}></div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              disabled={isLoading}
              style={{ display: 'none' }}
            />
            
            <div style={styles.dropIcon(isDragging)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            
            <h3 style={styles.dropTitle(isDragging)}>
              {isDragging ? 'Drop to upload' : 'Drag & Drop your file here'}
            </h3>
            
            <p style={styles.dropDescription}>
              or <span ref={browseTextRef} style={{...styles.browseText}}>
                browse files
                <span className="browse-underline" style={{
                  content: '""',
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  width: '100%',
                  height: '2px',
                  background: 'currentColor',
                  transform: 'scaleX(0)',
                  transformOrigin: 'right',
                  transition: 'transform 0.3s ease'
                }}></span>
              </span>
            </p>
            
            <p style={styles.fileSpecs}>
              Supports PowerPoint files (.ppt, .pptx) up to 50MB
            </p>
          </div>
        )}
        
        {selectedFile && !showProgress && (
          <div style={styles.selectedFile()} className="file-card">
            <div style={styles.fileIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
            </div>
            <div style={styles.fileDetails}>
              <div style={styles.fileName}>{selectedFile.name}</div>
              <div style={styles.fileSize}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation(); 
                setSelectedFile(null); 
                setMessage('');
              }}
              style={styles.fileRemoveBtn()}
              aria-label="Remove file"
              className="file-remove-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
        
        {!showProgress && (
          <button 
            style={styles.uploadButton(!selectedFile || isLoading)}
            onClick={handleUpload} 
            disabled={!selectedFile || isLoading}
            className="upload-button"
          >
            {isLoading ? (
              <>
                <span style={styles.loadingSpinner} className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Analyze Pitch Deck
              </>
            )}
            <span className="button-shine" style={styles.buttonAfter}></span>
          </button>
        )}
        
        {message && !showProgress && (
          <div style={styles.message(messageType)} className="message">
            <div style={styles.messageIcon}>
              {messageType === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              )}
              {messageType === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )}
              {messageType === 'info' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              )}
            </div>
            <div style={styles.messageContent}>{message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ProgressBar } from './UserDashboard';

const FileUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const { token } = useAuth();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress tracking state
  const [analysisId, setAnalysisId] = useState<number | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear polling when component unmounts
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("Polling stopped.");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setMessage('');
    setSelectedFile(null);
    resetProgress(); // Reset progress tracking

    if (file) {
      validateAndSetFile(file);
    }
  };

  const resetProgress = () => {
    stopPolling();
    setAnalysisId(null);
    setAnalysisStatus(null);
    setShowProgress(false);
  };

  const validateAndSetFile = (file: File) => {
    const allowedExtensions = /\.(ppt|pptx)$/i;
    if (!allowedExtensions.test(file.name)) {
      setMessage('Please upload a PowerPoint file (.ppt or .pptx).');
      setMessageType('error');
      return;
    }
    const maxSizeInBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setMessage(`File size exceeds ${maxSizeInBytes / (1024 * 1024)} MB.`);
      setMessageType('error');
      return;
    }

    setSelectedFile(file);
    setMessage(`Selected file: ${file.name}\n\nNOTE: For best results:\n- Keep slides between 5-20\n- Text-based content is preferred\n- Images with text will be processed using OCR\n- Use clear, readable fonts in images`);
    setMessageType('info');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Function to poll analysis status
  const pollStatus = (id: number) => {
    stopPolling(); // Clear any previous interval

    console.log(`Starting polling for Analysis ID: ${id}`);
    setAnalysisStatus('UPLOADING_DECK'); // Initial status
    setShowProgress(true);

    pollingIntervalRef.current = setInterval(async () => {
      if (!token) {
        stopPolling();
        setMessage("Authentication error during status check.");
        setMessageType('error');
        setIsLoading(false); // Stop loading on auth error
        setShowProgress(false); // Hide progress bar
        return;
      }
      try {
        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const response = await axios.get(`http://localhost:5001/api/analysis/status/${id}`, config);
        const newStatus = response.data?.status || 'UNKNOWN';
        
        console.log(`Poll status for ${id}: ${newStatus}`);
        setAnalysisStatus(newStatus);
        
        // Stop polling if completed or failed
        if (newStatus.toUpperCase() === 'COMPLETED' || newStatus.toUpperCase() === 'FAILED') {
          if (newStatus.toUpperCase() === 'COMPLETED') {
            setMessageType('success');
            setMessage('Analysis completed successfully! View the results in your history below.');
            // Stop polling for completed status too
            stopPolling(); 
            // Don't hide progress bar yet, let it reach 100% and call onComplete
          } else {
            setMessageType('error');
            setMessage('Analysis failed. Please try again or contact support if the issue persists.');
            stopPolling();
            setIsLoading(false);
            setShowProgress(false);
          }
        }
      } catch (error: any) {
        console.error(`Polling error for Analysis ID ${id}:`, error);
        let errorMessage = "Error checking analysis status.";
        
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            errorMessage = "Analysis record not found.";
          } else if (error.response?.status === 401) {
            errorMessage = "Authentication error during status check. Please log in again.";
          } else if (error.response) {
            errorMessage = `Status check error (${error.response.status}): ${error.response.data.message || 'Server error'}`;
          } else if (error.request) {
            errorMessage = "Status check failed: No response from server.";
          } else {
            errorMessage = `Status check failed: ${error.message}`;
          }
        }
        
        setMessage(errorMessage);
        setMessageType('error');
        stopPolling();
        setIsLoading(false);
        setShowProgress(false);
      }
    }, 3000); // Poll every 3 seconds
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first.');
      setMessageType('error');
      return;
    }

    if (!token) {
      setMessage('You must be logged in to upload a file.');
      setMessageType('error');
      return;
    }

    resetProgress(); // Reset any previous progress
    setIsLoading(true);
    setMessage(`Uploading ${selectedFile.name}...`);
    setMessageType('info');
    // Show progress bar immediately with initial "uploading" status
    setShowProgress(true);
    setAnalysisStatus('UPLOADING_DECK');

    const formData = new FormData();
    formData.append('pitchDeck', selectedFile);

    try {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.post('http://localhost:5001/upload', formData, config);

      // Check if we got back an analysis ID to track
      if (response.data && response.data.analysisId) {
        const id = response.data.analysisId;
        console.log("Upload accepted, starting status polling for ID:", id);
        setAnalysisId(id);
        pollStatus(id);
      } else {
        console.error("Backend did not return an analysis ID", response.data);
        setMessage("Error: Could not initiate analysis tracking.");
        setMessageType('error');
        setIsLoading(false);
        setShowProgress(false); // Hide progress bar on error
      }
    } catch (error: any) {
      console.error('Upload error details:', error);
      let errMsg = 'Upload failed.';
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errMsg = `Upload failed (${error.response.status}): ${error.response.data.message || 'Server error'}`;
          if (error.response.status === 401) {
            errMsg += ' Your session might have expired. Please log out and log back in.';
          }
        } else if (error.request) {
          errMsg = 'Upload failed: No response from server. Is it running?';
        } else {
          errMsg = `Upload failed: ${error.message}`;
        }
      } else {
        errMsg = 'Upload failed: An unexpected error occurred.';
      }
      setMessage(errMsg);
      setMessageType('error');
      
      // Reset progress on error
      resetProgress();
      setIsLoading(false);
      setShowProgress(false); // Hide progress bar on error
    }
  };

  const handleProgressComplete = () => {
    // Scroll to the history section and highlight the newest entry
    const historyElement = document.getElementById('history-section');
    if (historyElement) {
      historyElement.scrollIntoView({ behavior: 'smooth' });
      
      // Find the newest entry (first row in the table) and highlight it
      setTimeout(() => {
        const tableRows = document.querySelectorAll('#analysis-history-table tbody tr');
        if (tableRows.length > 0) {
          const newestRow = tableRows[0];
          const originalBg = window.getComputedStyle(newestRow).backgroundColor;
          
          // Add highlight
          (newestRow as HTMLElement).style.backgroundColor = 'rgba(var(--primary-color-rgb), 0.2)';
          (newestRow as HTMLElement).style.transition = 'background-color 0.5s ease';
          
          // Remove highlight after 2 seconds
          setTimeout(() => {
            (newestRow as HTMLElement).style.backgroundColor = originalBg;
          }, 2000);
        }
      }, 500);
    }
    
    // Stop polling, hide progress and reset states
    stopPolling();
    setShowProgress(false);
    setIsLoading(false);
    setAnalysisId(null);
    setAnalysisStatus(null);
    setSelectedFile(null); // Clear the selected file now that upload is complete
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-container" style={{ maxWidth: 'var(--container-lg)', margin: '0 auto', padding: '1rem' }}>
      <div className="upload-card">
        <div className="card-header">
          <h2 style={{margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Pitch Deck for Analysis
          </h2>
        </div>
        <div className="card-body" style={{ padding: '1.5rem' }}>
          {!showProgress && !isLoading && (
            <p className="mb-4" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Upload your presentation to get an AI-powered investment analysis report, including risk assessment, market potential, and investment recommendations.
            </p>
          )}
          
          {showProgress && (
            <div style={{ marginBottom: '1.5rem' }}>
              <ProgressBar 
                status={analysisStatus} 
                analysisId={analysisId}
                onComplete={handleProgressComplete}
              />
            </div>
          )}
          
          <div 
            className={`drag-drop-area ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            style={{
              border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              cursor: isLoading || showProgress ? 'default' : 'pointer', 
              marginBottom: '1.5rem',
              backgroundColor: isDragging 
                ? (theme === 'dark' ? 'rgba(var(--primary-color-rgb), 0.1)' : 'rgba(var(--primary-color-rgb), 0.05)') 
                : (theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
              transition: 'all 0.2s ease',
              opacity: isLoading || showProgress ? 0.6 : 1, // Dim when loading/processing
              display: showProgress ? 'none' : 'block' // Hide when progress is shown
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              disabled={isLoading || showProgress}
              style={{ display: 'none' }}
            />
            
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              backgroundColor: isDragging 
                ? 'rgba(var(--primary-color-rgb), 0.2)'
                : (theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'),
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isDragging ? 'var(--primary-color)' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            
            <h3 style={{ color: isDragging ? 'var(--primary-color)' : 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {isDragging ? 'Drop your file here' : 'Drag & Drop your presentation here'}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              or click to browse your files
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Supports PowerPoint files (.ppt, .pptx) up to 50MB
            </p>
          </div>
          
          {selectedFile && !showProgress && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-lg)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--primary-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white' 
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedFile.name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation(); 
                  setSelectedFile(null); 
                  setMessage('');
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = 'var(--error)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
          
          {!showProgress && (
            <button 
              className="analyze-button"
              onClick={handleUpload} 
              disabled={!selectedFile || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-sm)',
                padding: '0.75rem 2rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontWeight: '500',
                width: '100%',
                backgroundColor: !selectedFile || isLoading ? 
                  (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)') : 
                  'var(--primary-color)',
                color: !selectedFile || isLoading ? 'var(--text-muted)' : 'white',
                cursor: !selectedFile || isLoading ? 'not-allowed' : 'pointer',
                border: 'none',
                transition: 'all 0.3s ease',
                boxShadow: !selectedFile || isLoading ? 'none' : '0 2px 5px rgba(var(--primary-color-rgb), 0.2)'
              }}
              onMouseOver={(e) => {
                if (selectedFile && !isLoading) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(var(--primary-color-rgb), 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedFile && !isLoading) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 5px rgba(var(--primary-color-rgb), 0.2)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner" style={{
                    display: 'inline-block', 
                    border: `2px solid rgba(${theme === 'dark' ? '255, 255, 255, 0.2' : '0, 0, 0, 0.1'})`, 
                    borderTopColor: 'var(--text-muted)', 
                    borderRadius: '50%', 
                    width: '18px', 
                    height: '18px', 
                    animation: 'spin 0.8s linear infinite' 
                  }}></div>
                  Processing Deck...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Analyze Pitch Deck
                </>
              )}
            </button>
          )}
          
          {message && !showProgress && (
            <div style={{
              backgroundColor: 
                messageType === 'success' ? 'rgba(16, 185, 129, 0.1)' : 
                messageType === 'error' ? 'rgba(239, 68, 68, 0.1)' : 
                'rgba(59, 130, 246, 0.1)',
              color: 
                messageType === 'success' ? 'var(--success)' : 
                messageType === 'error' ? 'var(--error)' : 
                'var(--info)',
              padding: 'var(--spacing-lg)',
              borderRadius: 'var(--radius-lg)',
              marginTop: 'var(--spacing-lg)',
              border: `1px solid ${
                messageType === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                messageType === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                'rgba(59, 130, 246, 0.2)'
              }`,
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              {messageType === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginTop: '2px', flexShrink: 0}}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              )}
              {messageType === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginTop: '2px', flexShrink: 0}}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )}
              {messageType === 'info' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginTop: '2px', flexShrink: 0}}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              )}
              <div style={{whiteSpace: 'pre-line'}}>{message}</div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .drag-drop-area:hover {
          ${!isLoading && !showProgress ? `
            border-color: var(--primary-color);
            background-color: ${theme === 'dark' ? 'rgba(var(--primary-color-rgb), 0.05)' : 'rgba(var(--primary-color-rgb), 0.03)'};
          ` : ''}
        }
      `}</style>
    </div>
  );
};

export default FileUpload;
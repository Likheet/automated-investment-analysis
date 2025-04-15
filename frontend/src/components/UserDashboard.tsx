import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { format } from 'date-fns';

interface AnalysisRecord {
    id: number;
    user_id: number;
    original_filename: string;
    pdf_s3_key: string;
    processing_status: string;
    recommendation: string | null;
    overall_score: number | null;
    created_at: string;
    email_status?: string | null;
    email_failure_reason?: string | null;
}

// Progress bar component for tracking analysis progress
const ProgressBar: React.FC<{ 
    status: string | null; 
    analysisId?: number | null;
    onComplete: () => void;
}> = ({ status, onComplete }) => {
    const { theme } = useTheme();
    const [isComplete, setIsComplete] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [detailedStatus, setDetailedStatus] = useState<string>("Initializing analysis...");
    const [logs, setLogs] = useState<string[]>(["Initializing analysis..."]);
    const prevStatusRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (!status) return;
        
        const upperStatus = status.toUpperCase();
        
        // Don't update if status hasn't changed (helps prevent duplicate logs)
        if (prevStatusRef.current === upperStatus) return;
        
        prevStatusRef.current = upperStatus;
        
        if (upperStatus === 'COMPLETED') {
            // Animate to completion state
            setShouldAnimate(false);
            setIsComplete(true);
            setDetailedStatus("Analysis completed successfully!");
            
            // Add completion to logs
            setLogs(prevLogs => [...prevLogs, "✅ Analysis completed successfully!"]);
            
            // Trigger the complete callback after a short delay
            setTimeout(() => {
                onComplete();
            }, 2500);
        } else if (upperStatus !== 'FAILED') {
            // Any other processing status - show animation
            setShouldAnimate(true);
            setIsComplete(false);
            
            // Update detailed status text and logs
            const statusDetails = getDetailedStatus(upperStatus);
            setDetailedStatus(statusDetails);
            
            // Add to logs (without duplicating)
            setLogs(prevLogs => {
                // Add the new log only if it's different from the last one
                if (prevLogs.length === 0 || prevLogs[prevLogs.length-1] !== statusDetails) {
                    return [...prevLogs, statusDetails];
                }
                return prevLogs;
            });
        }
    }, [status, onComplete]);
    
    const getDetailedStatus = (statusCode: string): string => {
        switch (statusCode) {
            case 'PENDING': return "Initializing analysis...";
            case 'UPLOADING_DECK': return "Uploading presentation to secure storage...";
            case 'EXTRACTING_TEXT': return "Extracting text content from presentation slides...";
            case 'ANALYZING_AI': return "AI analyzing pitch deck content...";
            case 'SAVING_ANALYSIS': return "Saving analysis results to database...";
            case 'GENERATING_PDF': return "Generating investment thesis PDF report...";
            case 'UPLOADING_PDF': return "Finalizing and storing the report...";
            case 'COMPLETED': return "Analysis completed successfully!";
            case 'FAILED': return "Analysis process failed. Please try again.";
            default: return statusCode;
        }
    };
    
    const getFormattedStatus = () => {
        if (!status) return "Initializing...";
        return detailedStatus;
    };
    
    return (
        <div className="progress-wrapper">
            <div className="progress-status-indicator">
                <div className="progress-track">
                    <div 
                        className={`progress-bar ${shouldAnimate ? 'animated' : ''} ${isComplete ? 'completed' : ''}`}
                    ></div>
                </div>
            </div>
            
            <div className="progress-details">
                <div className="progress-current-status">
                    {!isComplete ? (
                        <div className="status-icon pulsing">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                    ) : (
                        <div className="status-icon completed">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                    )}
                    <div className="status-text">{getFormattedStatus()}</div>
                </div>
            </div>
            
            {/* Show detailed progress logs */}
            <div className="progress-logs">
                {logs.map((log, index) => (
                    <div key={index} className={`log-entry ${index === logs.length - 1 ? 'current' : 'past'}`}>
                        {log}
                    </div>
                ))}
            </div>
            
            {!isComplete && (
                <p className="progress-note">
                    This may take a few minutes depending on the complexity of your pitch deck.
                </p>
            )}

            <style>{`
                .progress-wrapper {
                    padding: var(--spacing-lg);
                    background-color: var(--card-bg);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                }
                
                .progress-status-indicator {
                    margin-bottom: var(--spacing-md);
                }
                
                .progress-track {
                    height: 8px;
                    background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
                    border-radius: var(--radius-full);
                    overflow: hidden;
                    position: relative;
                }
                
                .progress-bar {
                    height: 100%;
                    border-radius: var(--radius-full);
                    position: relative;
                    overflow: hidden;
                    background-color: var(--primary-color);
                    width: 0;
                    transition: width 0.5s ease, background-color 0.5s ease;
                }

                .progress-bar.completed {
                    width: 100% !important;
                    background-color: var(--success);
                    transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.5s ease;
                }
                
                .progress-bar.animated {
                    animation: indeterminate 2.5s infinite;
                    background-image: linear-gradient(
                        90deg,
                        var(--primary-color) 0%,
                        var(--accent-color) 50%,
                        var(--primary-color) 100%
                    );
                    background-size: 200% 100%;
                    width: 100%;
                }
                
                .progress-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: var(--spacing-md);
                }
                
                .progress-current-status {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                }
                
                .status-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: var(--radius-full);
                }
                
                .status-icon.pulsing {
                    color: var(--primary-color);
                    animation: pulse 2s infinite ease-in-out;
                }
                
                .status-icon.completed {
                    color: var(--success);
                    animation: popIn 0.5s ease-out;
                }
                
                .status-text {
                    font-weight: 600;
                    color: var(--text-primary);
                    font-size: 1.05rem;
                }
                
                .progress-note {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    margin-top: var(--spacing-md);
                    font-style: italic;
                }
                
                .progress-logs {
                    margin-top: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background-color: ${theme === 'dark' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.02)'};
                    border-radius: var(--radius-md);
                    max-height: 180px;
                    overflow-y: auto;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem;
                    border: 1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
                }
                
                .log-entry {
                    padding: var(--spacing-xs) 0;
                    transition: all 0.3s ease;
                    animation: fadeIn 0.5s ease-out;
                }
                
                .log-entry.current {
                    color: var(--primary-color);
                    font-weight: 600;
                    padding-left: 3px;
                    border-left: 3px solid var(--primary-color);
                    animation: highlight-pulse 2s infinite ease-in-out;
                }
                
                .log-entry.past {
                    color: var(--text-secondary);
                    opacity: 0.8;
                }
                
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                
                @keyframes highlight-pulse {
                    0% { background-color: transparent; }
                    50% { background-color: ${theme === 'dark' ? 'rgba(var(--primary-color-rgb), 0.12)' : 'rgba(var(--primary-color-rgb), 0.06)'}; }
                    100% { background-color: transparent; }
                }
                
                @keyframes popIn {
                    0% { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                
                @keyframes indeterminate {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                
                @keyframes rotate-refresh {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes modalFadeIn { 
                    0% { opacity: 0; transform: translateY(-20px); } 
                    100% { opacity: 1; transform: translateY(0); } 
                }

                @keyframes highlight-new-row {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(var(--primary-color-rgb), 0.2); }
                }

                tr.newly-created {
                    animation: highlight-new-row 1.5s ease-in-out infinite;
                }

                @media (max-width: 768px) {
                    .status-text {
                        font-size: 0.9rem;
                    }
                    
                    .progress-logs {
                        max-height: 140px;
                        font-size: 0.8rem;
                    }
                }
            `}</style>
        </div>
    );
};

export { ProgressBar };

const UserDashboard: React.FC = () => {
    const [history, setHistory] = useState<AnalysisRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<string>('');
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState<boolean>(false);
    const [recordToDelete, setRecordToDelete] = useState<number | null>(null);
    const [isRefreshHovered, setIsRefreshHovered] = useState(false);
    const [isRefreshActive, setIsRefreshActive] = useState(false);
    const [newlyCreatedId, setNewlyCreatedId] = useState<number | null>(null);
    const { token } = useAuth();
    const { theme } = useTheme();
    
    // Create ref for scrolling to history section
    const historyHeaderRef = useRef<HTMLDivElement>(null);
    
    // Format timestamps
    const formatTimestamp = (timestamp: string) => {
        return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    };
    
    // Fetch analysis history
    const fetchHistory = useCallback(async () => {
        if (!token) {
            setError('Not authenticated. Please log in again.');
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            const response = await axios.get('http://localhost:5001/api/analysis/history', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            setHistory(response.data || []);
        } catch (err: any) {
            console.error('Error fetching history:', err);
            if (err.response) {
                setError(`Failed to fetch history: ${err.response.data.message || err.response.status}`);
            } else if (err.request) {
                setError('Network error: Could not connect to the server.');
            } else {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [token]);
    
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    // Delete confirmation handlers
    const handleDeleteClick = (id: number) => {
        setRecordToDelete(id);
        setConfirmDeleteModalOpen(true);
    };
    
    const handleCancelDelete = () => {
        setConfirmDeleteModalOpen(false);
        setRecordToDelete(null);
    };
    
    // Delete record handler
    const deleteRecord = async () => {
        if (!token || !recordToDelete) return;
        
        setConfirmDeleteModalOpen(false);
        setDeletingId(recordToDelete);
        
        try {
            await axios.delete(`http://localhost:5001/api/analysis/record/${recordToDelete}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Update local state
            setHistory(prevHistory => prevHistory.filter(record => record.id !== recordToDelete));
            
            // Show success toast
            showSuccessToast('Record deleted successfully!');
        } catch (err: any) {
            console.error('Error deleting record:', err);
            
            let errorMessage = 'Failed to delete record';
            
            if (axios.isAxiosError(err)) {
                if (err.response) {
                    errorMessage = `${errorMessage}: ${err.response.data.message || err.response.statusText}`;
                    
                    if (err.response.status === 404) {
                        errorMessage = 'Record not found or already deleted';
                    } else if (err.response.status === 403) {
                        errorMessage = 'You don\'t have permission to delete this record';
                    }
                } else if (err.request) {
                    errorMessage = 'Network error: Could not connect to server';
                } else {
                    errorMessage = `${errorMessage}: ${err.message}`;
                }
            }
            
            // Show error toast
            setToastType('error');
            setToastMessage(errorMessage);
            setShowToast(true);
        } finally {
            setDeletingId(null);
            setRecordToDelete(null);
        }
    };
    
    // Toast handling
    const showSuccessToast = (message: string) => {
        setToastMessage(message);
        setToastType('success');
        setShowToast(true);
    };
    
    const hideToast = () => {
        setShowToast(false);
    };

    // Download report handler
    const handleDownload = async (analysisId: number) => {
        if (!token) { 
            setError("Not authenticated."); 
            return; 
        }
        
        setError('');
        setDownloadingId(analysisId);
        
        try {
            const config = { 
                headers: { 'Authorization': `Bearer ${token}` },
                params: { attempt: new Date().getTime() }
            };
            
            const response = await axios.get(`http://localhost:5001/api/analysis/report/${analysisId}/download`, config);
            
            if (response.data && response.data.downloadUrl) {
                // Create an invisible anchor to trigger download
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.setAttribute('download', response.data.filename || `report-${analysisId}.pdf`);
                link.setAttribute('target', '_blank');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showSuccessToast('Download started!');
            } else {
                console.error("No download URL in response:", response);
                setError("Could not get download link. No URL provided.");
            }
        } catch (err: any) {
            console.error(`Error downloading report ID ${analysisId}:`, err);
            
            if (err.response?.data?.errorType === 'FILE_ACCESS_ERROR' || err.response?.data?.errorType === 'FILE_DELETED') {
                // Remove unavailable records
                setHistory(prevHistory => 
                    prevHistory.filter(record => record.id !== analysisId)
                );
                setError('The report file is no longer available in storage and has been removed from your history.');
                
                setTimeout(() => fetchHistory(), 2000);
            } else if (err.response) { 
                setError(err.response.data?.message || `Failed to download (Status: ${err.response.status}).`); 
            } else if (err.request) { 
                setError("Network error reaching download endpoint."); 
            } else { 
                setError(`Download error: ${err.message}`); 
            }
        } finally { 
            setDownloadingId(null); 
        }
    };
    
    // Get status display component
    const getStatusDisplay = (status: string | null): React.ReactElement => {
        if (!status) return <span>-</span>;
        
        switch(status.toUpperCase()) {
            case 'COMPLETED': 
                return (
                    <span className="status-badge status-completed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Completed
                    </span>
                );
            case 'PENDING': 
                return (
                    <span className="status-badge status-pending">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Pending
                    </span>
                );
            case 'UPLOADING_DECK': case 'EXTRACTING_TEXT': case 'ANALYZING_AI':
            case 'SAVING_ANALYSIS': case 'GENERATING_PDF': case 'UPLOADING_PDF':
                return (
                    <span className="status-badge status-processing">
                        <span className="loading-spinner" style={{width: '14px', height: '14px', margin: '0 4px 0 0'}}></span>
                        Processing
                    </span>
                );
            case 'FAILED': 
                return (
                    <span className="status-badge status-failed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        Failed
                    </span>
                );
            case 'FILE_UNAVAILABLE': 
                return (
                    <span className="status-badge status-unavailable">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                        Unavailable
                    </span>
                );
            default: 
                return (
                    <span className="status-badge">
                        {status || 'Unknown'}
                    </span>
                );
        }
    };
    
    // Get color based on score
    const getScoreColor = (score: number | null): string => {
        if (score === null) return 'var(--text-muted)';
        if (score >= 80) return 'var(--success)';
        if (score >= 60) return 'var(--info)';
        if (score >= 40) return 'var(--warning)';
        return 'var(--error)';
    };
    
    // Effect to scroll when component mounts if needed
    useEffect(() => {
        // Check if URL has a hash indicating we should scroll to history
        if (window.location.hash === '#history' && historyHeaderRef.current) {
            historyHeaderRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    // Handle analysis completion
    const handleAnalysisComplete = useCallback((id: number) => {
        // Refresh the history list first
        fetchHistory().then(() => {
            // Set the newly created ID to trigger the highlighting effect
            setNewlyCreatedId(id);
            
            // Scroll to history section
            if (historyHeaderRef.current) {
                historyHeaderRef.current.scrollIntoView({ behavior: 'smooth' });
                
                // Stop the highlighting effect after a reasonable time
                setTimeout(() => {
                    setNewlyCreatedId(null);
                }, 10000); // Stop blinking after 10 seconds
            }
        });
    }, [fetchHistory]);

    // Expose handleAnalysisComplete to window object for cross-component communication
    useEffect(() => {
        // Create a global handler for analysis completion
        (window as any).handleAnalysisComplete = handleAnalysisComplete;
        
        return () => {
            // Clean up the global handler when component unmounts
            delete (window as any).handleAnalysisComplete;
        };
    }, [handleAnalysisComplete]);

    return (
        <div className="analysis-history">
            <div className="dashboard-header" ref={historyHeaderRef} id="history-section">
                <div className="header-content">
                    <h1>Your Analysis History</h1>
                    <p>View and manage all your previous pitch deck analyses</p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        fetchHistory();
                    }}
                    onMouseEnter={() => setIsRefreshHovered(true)}
                    onMouseLeave={() => {
                        setIsRefreshHovered(false);
                        setIsRefreshActive(false);
                    }}
                    onMouseDown={() => setIsRefreshActive(true)}
                    onMouseUp={() => setIsRefreshActive(false)}
                    onTouchStart={() => setIsRefreshActive(true)}
                    onTouchEnd={() => setIsRefreshActive(false)}
                    disabled={isLoading}
                    className="refresh-button"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isRefreshActive 
                            ? 'var(--primary-color-darker, #0e7490)' 
                            : isRefreshHovered 
                                ? 'var(--primary-color-light, #22d3ee)' 
                                : 'var(--primary-color)',
                        color: 'var(--text-on-primary)',
                        border: 'none',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isRefreshActive 
                            ? 'inset 0 3px 5px rgba(0,0,0,0.2)' 
                            : '0 4px 6px rgba(0,0,0,0.1)',
                        transform: isRefreshActive ? 'translateY(2px)' : 'translateY(0)',
                        position: 'relative',
                        zIndex: 10,
                        outline: 'none'
                    }}
                >
                    {isLoading ? (
                        <>
                            <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span>
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{
                                    animation: isRefreshHovered ? 'rotate-refresh 1s ease-in-out' : 'none',
                                    transformOrigin: 'center'
                                }}
                            >
                                <path d="M3 2v6h6"></path>
                                <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
                                <path d="M21 22v-6h-6"></path>
                                <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
                            </svg>
                            Refresh
                        </>
                    )}
                </button>
            </div>
            
            {isLoading && (
                <div className="card loading-card">
                    <span className="loading-spinner" style={{width: '24px', height: '24px'}}></span>
                    <span>Loading analysis history...</span>
                </div>
            )}
            
            {error && (
                <div className="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {error}
                </div>
            )}
            
            {!isLoading && history.length === 0 && !error && (
                <div className="card empty-state">
                    <div className="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                    </div>
                    <h2>No Analysis History</h2>
                    <p>You haven't uploaded any pitch decks for analysis yet. Upload a deck to get started with AI-powered investment analysis.</p>
                </div>
            )}
            
            {!isLoading && history.length > 0 && (
                <div className="card table-card">
                    <div className="table-responsive">
                        <table id="analysis-history-table" className="analysis-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>File Name</th>
                                    <th>Status</th>
                                    <th>Recommendation</th>
                                    <th>Score</th>
                                    <th>Report</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((record) => (
                                    <tr key={record.id} className={record.id === newlyCreatedId ? 'newly-created' : ''}>
                                        <td className="date-cell">
                                            {formatTimestamp(record.created_at)}
                                        </td>
                                        <td className="filename-cell" title={record.original_filename || undefined}>
                                            <div className="file-name">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                                    <polyline points="13 2 13 9 20 9"></polyline>
                                                </svg>
                                                {record.original_filename || '-'}
                                            </div>
                                        </td>
                                        <td className="status-cell">
                                            {getStatusDisplay(record.processing_status)}
                                        </td>
                                        <td className={`recommendation-cell ${record.recommendation ? 
                                            (record.recommendation.includes('INVEST') ? 'recommend-invest' : 
                                            record.recommendation.includes('HOLD') || record.recommendation.includes('WAIT') ? 'recommend-hold' : 
                                            'recommend-pass') : ''}`}>
                                            {record.recommendation || '-'}
                                        </td>
                                        <td className="score-cell">
                                            {record.overall_score !== null ? (
                                                <span className="score" style={{color: getScoreColor(record.overall_score)}}>
                                                    {record.overall_score}
                                                    <span className="score-max">/100</span>
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="report-cell">
                                            {record.processing_status?.toUpperCase() === 'COMPLETED' && record.pdf_s3_key ? (
                                                <button 
                                                    onClick={() => handleDownload(record.id)} 
                                                    disabled={downloadingId === record.id} 
                                                    className="btn btn-sm btn-primary"
                                                >
                                                    {downloadingId === record.id ? (
                                                        <span className="loading-spinner" style={{width: '14px', height: '14px'}}></span>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    )}
                                                    Download
                                                </button>
                                            ) : (
                                                <span className="unavailable-text">Unavailable</span>
                                            )}
                                        </td>
                                        <td className="actions-cell">
                                            {record.processing_status?.toUpperCase() === 'COMPLETED' && record.email_status && (
                                                <span className={`email-status ${record.email_status === 'SENT' ? 'email-sent' : 'email-failed'}`}>
                                                    {record.email_status === 'SENT' ? (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="22 6 12 17 4 12"></polyline>
                                                            </svg>
                                                            Sent
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                                            </svg>
                                                            Failed
                                                        </>
                                                    )}
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteClick(record.id)} 
                                                disabled={deletingId === record.id} 
                                                className="btn btn-sm btn-error"
                                            >
                                                {deletingId === record.id ? (
                                                    <span className="loading-spinner" style={{width: '14px', height: '14px'}}></span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
                                                        <path d="M10 11v6"></path>
                                                        <path d="M14 11v6"></path>
                                                    </svg>
                                                )}
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* Modal & Toast */}
            {confirmDeleteModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Confirm Deletion</h3>
                        <p>Are you sure you want to delete this record? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-error" onClick={deleteRecord}>Delete</button>
                            <button className="btn" onClick={handleCancelDelete}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showToast && (
                <div className={`toast toast-${toastType}`}>
                    <span>{toastMessage}</span>
                    <button onClick={hideToast}>&times;</button>
                </div>
            )}

            <style>{`
                /* Custom styling for the UserDashboard component */
                .analysis-history {
                    width: 100%;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-xl) var(--spacing-2xl);
                    border-radius: var(--radius-xl);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: var(--spacing-3xl) var(--spacing-2xl);
                    text-align: center;
                    animation: fadeIn 0.5s ease-out;
                }

                .empty-state-icon {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background-color: rgba(var(--primary-color-rgb), 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: var(--spacing-lg);
                }

                .empty-state h2 {
                    margin-bottom: var(--spacing-sm);
                }

                .empty-state p {
                    max-width: 500px;
                    color: var(--text-secondary);
                }

                .loading-card {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding: var(--spacing-xl);
                    color: var(--text-secondary);
                }

                .table-card {
                    padding: 0;
                    overflow: hidden;
                }

                .table-responsive {
                    width: 100%;
                    overflow-x: auto;
                }

                .analysis-table {
                    width: 100%;
                    border-collapse: collapse;
                    color: var(--text-primary);
                }

                .analysis-table thead tr {
                    background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
                    text-align: left;
                }

                .analysis-table th {
                    padding: var(--spacing-md);
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                    border-bottom: 1px solid var(--border-color);
                }

                .analysis-table td {
                    padding: var(--spacing-md);
                    border-bottom: 1px solid var(--border-color);
                    font-size: 0.9rem;
                }

                .analysis-table tr:last-child td {
                    border-bottom: none;
                }

                .analysis-table tr {
                    transition: background-color 0.2s ease;
                }

                .analysis-table tbody tr:nth-child(even) {
                    background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'};
                }

                .analysis-table tbody tr:hover {
                    background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
                }

                .date-cell {
                    white-space: nowrap;
                }

                .filename-cell {
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .file-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .file-name svg {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: var(--radius-full);
                    font-size: 0.85rem;
                    font-weight: 500;
                    gap: 4px;
                }

                .status-completed {
                    color: var(--success);
                    background-color: rgba(16, 185, 129, 0.1);
                }

                .status-pending {
                    color: var(--warning);
                    background-color: rgba(245, 158, 11, 0.1);
                }

                .status-processing {
                    color: var(--info);
                    background-color: rgba(59, 130, 246, 0.1);
                }

                .status-failed {
                    color: var(--error);
                    background-color: rgba(239, 68, 68, 0.1);
                }

                .status-unavailable {
                    color: var(--text-muted);
                    background-color: rgba(156, 163, 175, 0.1);
                    font-style: italic;
                }

                .recommendation-cell {
                    font-weight: 500;
                }

                .recommend-invest {
                    color: var(--success);
                }

                .recommend-hold {
                    color: var(--warning);
                }

                .recommend-pass {
                    color: var(--error);
                }

                .score {
                    font-weight: 600;
                    display: flex;
                    align-items: baseline;
                    gap: 2px;
                }

                .score-max {
                    font-size: 0.75rem;
                    opacity: 0.8;
                    font-weight: normal;
                }

                .unavailable-text {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    font-style: italic;
                }

                .actions-cell {
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .email-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    border-radius: var(--radius-full);
                    padding: 2px 10px;
                }

                .email-sent {
                    color: var(--success);
                    background-color: rgba(16, 185, 129, 0.08);
                }

                .email-failed {
                    color: var(--warning);
                    background-color: rgba(245, 158, 11, 0.08);
                }

                /* Progress bar styling */
                .progress-card {
                    margin-bottom: var(--spacing-lg);
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-sm);
                }

                .progress-status {
                    display: flex;
                    align-items: center;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .progress-percentage {
                    font-weight: 500;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }

                .progress-bar-container {
                    height: 8px;
                    background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
                    border-radius: var(--radius-full);
                    overflow: hidden;
                }

                .progress-bar-fill {
                    height: 100%;
                    border-radius: var(--radius-full);
                    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .progress-note {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    margin: var(--spacing-sm) 0 0 0;
                    font-style: italic;
                }

                /* Modal styling */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background-color: var(--card-bg);
                    color: var(--text-primary);
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-xl);
                    width: 90%;
                    max-width: 400px;
                    box-shadow: var(--shadow-lg);
                    border: 1px solid var(--border-color);
                    animation: modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .modal-content h3 {
                    margin-top: 0;
                    color: var(--text-primary);
                }

                .modal-content p {
                    color: var(--text-secondary);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-lg);
                }

                .btn-error {
                    background-color: var(--error);
                    color: white;
                }

                .btn-error:hover {
                    background-color: #e11d48;
                    transform: translateY(-3px);
                    box-shadow: 0 10px 20px -10px rgba(239, 68, 68, 0.5);
                }

                /* Toast styling */
                .toast {
                    position: fixed;
                    bottom: var(--spacing-xl);
                    right: var(--spacing-xl);
                    background-color: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: var(--spacing-md) var(--spacing-lg);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-lg);
                    display: flex;
                    align-items: center;
                    max-width: 400px;
                    z-index: 9999;
                    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    gap: var(--spacing-sm);
                }

                .toast-success {
                    background-color: rgba(16, 185, 129, 0.95);
                }

                .toast-error {
                    background-color: rgba(239, 68, 68, 0.95);
                }

                /* Animations */
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

                @keyframes modalFadeIn { 
                    0% { opacity: 0; transform: translateY(-20px); } 
                    100% { opacity: 1; transform: translateY(0); } 
                }

                @keyframes rotate-refresh {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes highlight-new-row {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(var(--primary-color-rgb), 0.2); }
                }

                tr.newly-created {
                    animation: highlight-new-row 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default UserDashboard;

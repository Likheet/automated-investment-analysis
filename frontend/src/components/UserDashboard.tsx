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

// Define the processing status stages in order
const PROCESSING_STAGES = [
    'UPLOADING_DECK',
    'EXTRACTING_TEXT',
    'ANALYZING_AI',
    'SAVING_ANALYSIS',
    'GENERATING_PDF',
    'UPLOADING_PDF',
    'COMPLETED'
];

// Progress bar component for tracking analysis progress
const ProgressBar: React.FC<{ 
    status: string | null; 
    analysisId?: number | null; // Make parameter optional since it's unused
    onComplete: () => void;
}> = ({ status, onComplete }) => { // Remove analysisId from destructuring
    const { theme } = useTheme();
    const [progress, setProgress] = useState(0);
    
    useEffect(() => {
        // Calculate progress based on status
        if (!status) {
            setProgress(0);
            return;
        }
        
        const upperStatus = status.toUpperCase();
        const currentStageIndex = PROCESSING_STAGES.indexOf(upperStatus);
        
        if (currentStageIndex === -1) {
            // Status not recognized
            setProgress(0);
        } else if (upperStatus === 'COMPLETED') {
            setProgress(100);
            onComplete();
        } else {
            // Calculate percentage based on stage
            const stageProgress = (currentStageIndex + 1) / PROCESSING_STAGES.length;
            setProgress(Math.round(stageProgress * 100));
        }
    }, [status, onComplete]);
    
    const getFormattedStatus = () => {
        if (!status) return "Initializing...";
        
        switch (status.toUpperCase()) {
            case 'UPLOADING_DECK': return 'Uploading presentation...';
            case 'EXTRACTING_TEXT': return 'Extracting content...';
            case 'ANALYZING_AI': return 'AI analyzing pitch deck...';
            case 'SAVING_ANALYSIS': return 'Saving analysis results...';
            case 'GENERATING_PDF': return 'Generating PDF report...';
            case 'UPLOADING_PDF': return 'Finalizing report...';
            case 'COMPLETED': return 'Analysis completed!';
            default: return status;
        }
    };
    
    return (
        <div style={{
            marginBottom: '1.5rem',
            backgroundColor: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem'
            }}>
                <div style={{ 
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    {progress < 100 ? (
                        <div style={{ 
                            display: 'inline-block', 
                            border: `2px solid rgba(${theme === 'dark' ? '255, 255, 255, 0.2' : '0, 0, 0, 0.1'})`, 
                            borderTopColor: 'var(--primary-color)', 
                            borderRadius: '50%', 
                            width: '16px', 
                            height: '16px', 
                            animation: 'spin 0.8s linear infinite',
                            animationDuration: '1.2s'
                        }}></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    )}
                    {getFormattedStatus()}
                </div>
                <div style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                }}>{progress}%</div>
            </div>
            <div style={{
                height: '8px',
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary-color)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}></div>
            </div>
            {progress < 100 && (
                <p style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--text-muted)', 
                    margin: '0.75rem 0 0 0',
                    fontStyle: 'italic'
                }}>
                    This may take a few minutes depending on the complexity of your pitch deck.
                </p>
            )}
        </div>
    );
};

const LoadingSpinner: React.FC<{ size?: string; color?: string }> = ({ size = '16px', color }) => {
    const { theme } = useTheme();
    const spinnerColor = color || (theme === 'dark' ? '#6366f1' : '#4f46e5');
    
    return (
        <div style={{ 
            display: 'inline-block', 
            border: `2px solid rgba(${theme === 'dark' ? '255, 255, 255, 0.2' : '0, 0, 0, 0.1'})`, 
            borderTopColor: spinnerColor, 
            borderRadius: '50%', 
            width: size, 
            height: size, 
            marginRight: '8px', 
            animation: 'spin 0.8s linear infinite',
            animationDuration: '1.2s'
        }}></div>
    );
};

// Custom modal for delete confirmation
const ConfirmDeleteModal: React.FC<{
    isOpen: boolean;
    recordId: number | null;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, recordId, onConfirm, onCancel }) => {
    const { theme } = useTheme();
    
    if (!isOpen) return null;
    
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                width: '90%',
                maxWidth: '400px',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-color)',
                animation: 'modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Confirm Deletion</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Are you sure you want to delete this record (ID: {recordId})? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button 
                        onClick={onCancel}
                        style={{ 
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        style={{ 
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: 'var(--error)',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: '500',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 5px rgba(239, 68, 68, 0.2)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#e11d48';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--error)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 5px rgba(239, 68, 68, 0.2)';
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export { ProgressBar };

const UserDashboard: React.FC = () => {
    const [history, setHistory] = useState<AnalysisRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState<boolean>(false);
    const [recordToDelete, setRecordToDelete] = useState<number | null>(null);
    const { token } = useAuth();
    const { theme } = useTheme();
    
    const formatTimestamp = (timestamp: string) => {
        // Format the timestamp in a user-friendly way
        return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    };
    
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
            
            // Backend returns result.rows directly, not wrapped in a history property
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
    
    const handleDeleteClick = (id: number) => {
        setRecordToDelete(id);
        setConfirmDeleteModalOpen(true);
    };
    
    const handleCancelDelete = () => {
        setConfirmDeleteModalOpen(false);
        setRecordToDelete(null);
    };
    
    const deleteRecord = async () => {
        if (!token || !recordToDelete) return;
        
        setConfirmDeleteModalOpen(false);
        setDeletingId(recordToDelete);
        
        try {
            await axios.delete(`http://localhost:5001/api/analysis/${recordToDelete}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Update local state to remove the deleted record
            setHistory(prevHistory => prevHistory.filter(record => record.id !== recordToDelete));
            setSuccessMessage('Record deleted successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error deleting record:', err);
            setError(err.response?.data?.message || 'Failed to delete record');
            setTimeout(() => setError(''), 5000);
        } finally {
            setDeletingId(null);
            setRecordToDelete(null);
        }
    };
    
    const handleDownload = async (analysisId: number) => {
        if (!token) { setError("Not authenticated."); return; }
        setError('');
        setDownloadingId(analysisId);
        try {
            const config = { 
                headers: { 'Authorization': `Bearer ${token}` },
                // Try using a direct download approach first
                params: { attempt: new Date().getTime() } // Add cache-busting parameter
            };
            const response = await axios.get(`http://localhost:5001/api/analysis/report/${analysisId}/download`, config);
            
            if (response.data && response.data.downloadUrl) {
                console.log("Opening download URL:", response.data.filename);
                
                // Create an invisible anchor element to trigger the download
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.setAttribute('download', response.data.filename || `report-${analysisId}.pdf`);
                link.setAttribute('target', '_blank');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Show a success notification
                setSuccessMessage('Download started!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                console.error("No download URL in response:", response);
                setError("Could not get download link. No URL provided.");
            }
        } catch (err: any) {
            console.error(`Error downloading report ID ${analysisId}:`, err);
            
            // Check if this is a file access error
            if (err.response?.data?.errorType === 'FILE_ACCESS_ERROR' || err.response?.data?.errorType === 'FILE_DELETED') {
                // Remove the unavailable record from the UI immediately
                setHistory(prevHistory => 
                    prevHistory.filter(record => record.id !== analysisId)
                );
                setError('The report file is no longer available in storage and has been removed from your history.');
                
                // Refresh the history after a short delay
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
    
    const getStatusDisplay = (status: string | null): React.ReactElement => {
        if (!status) return <span>-</span>;
        
        switch(status.toUpperCase()) {
            case 'COMPLETED': 
                return (
                    <span style={{ 
                        color: 'var(--success)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Completed
                    </span>
                );
            case 'PENDING': 
                return (
                    <span style={{ 
                        color: 'var(--warning)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Pending
                    </span>
                );
            case 'UPLOADING_DECK': case 'EXTRACTING_TEXT': case 'ANALYZING_AI':
            case 'SAVING_ANALYSIS': case 'GENERATING_PDF': case 'UPLOADING_PDF':
                return (
                    <span style={{ 
                        color: 'var(--info)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                    }}>
                        <LoadingSpinner size="12px" color="var(--info)" />
                        Processing
                    </span>
                );
            case 'FAILED': 
                return (
                    <span style={{ 
                        color: 'var(--error)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        Failed
                    </span>
                );
            case 'FILE_UNAVAILABLE': 
                return (
                    <span style={{ 
                        color: 'var(--text-muted)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        fontStyle: 'italic'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        Unavailable
                    </span>
                );
            default: 
                return (
                    <span style={{ 
                        color: 'var(--text-muted)', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                    }}>
                        {status || 'Unknown'}
                    </span>
                );
        }
    };

    const getScoreColor = (score: number | null): string => {
        if (score === null) return 'var(--text-muted)';
        if (score >= 80) return 'var(--success)';
        if (score >= 60) return 'var(--info)';
        if (score >= 40) return 'var(--warning)';
        return 'var(--error)';
    };
    
    // Create ref for scrolling to history section
    const historyHeaderRef = useRef<HTMLDivElement>(null);

    // Effect to scroll when component mounts if needed
    useEffect(() => {
        // Check if URL has a hash indicating we should scroll to history
        if (window.location.hash === '#history' && historyHeaderRef.current) {
            historyHeaderRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    return (
        <div className="dashboard-container" style={{ fontFamily: 'Inter, sans-serif', padding: '1.5rem', maxWidth: 'var(--container-width)', margin: '0 auto' }}>
            <div className="dashboard-header" ref={historyHeaderRef} id="history-section">
                <div className="header-content">
                    <h1 style={{ color: 'white', marginBottom: '0.5rem' }}>Your Analysis History</h1>
                    <p style={{ opacity: 0.9, marginBottom: '0' }}>View and manage all your previous pitch deck analyses</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={fetchHistory}
                        disabled={isLoading}
                        style={{
                            background: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.5rem 1.25rem',
                            fontWeight: 500,
                            fontSize: '1rem',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 5px rgba(var(--primary-color-rgb), 0.12)'
                        }}
                    >
                        {isLoading ? (
                            <LoadingSpinner size="18px" color="white" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M1 20v-6a8 8 0 0 1 8-8h12"></path></svg>
                        )}
                        Refresh
                    </button>
                </div>
            </div>
            
            {isLoading && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--card-bg)',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-color)'
                }}>
                    <LoadingSpinner size="24px" />
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem', fontSize: '1rem' }}>Loading analysis history...</span>
                </div>
            )}
            
            {error && (
                <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.75rem' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {error}
                </div>
            )}
            
            {successMessage && (
                <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.75rem' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    {successMessage}
                </div>
            )}
            
            {!isLoading && history.length === 0 && !error && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--card-bg)',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-color)',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                    </div>
                    <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>No Analysis History</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px' }}>
                        You haven't uploaded any pitch decks for analysis yet. Upload a deck to get started with AI-powered investment analysis.
                    </p>
                </div>
            )}
            
            {!isLoading && history.length > 0 && (
                <div style={{
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--card-bg)',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table id="analysis-history-table" style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            color: 'var(--text-primary)'
                        }}>
                            <thead>
                                <tr style={{ 
                                    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                    borderBottom: `1px solid var(--border-color)`,
                                    textAlign: 'left'
                                }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Date</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>File Name</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Recommendation</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Score</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Report</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((record, index) => (
                                    <tr key={record.id} style={{ 
                                        borderBottom: index === history.length - 1 ? 'none' : `1px solid var(--border-color)`,
                                        backgroundColor: index % 2 === 0 ? 'transparent' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'),
                                        transition: 'background-color 0.3s ease',
                                        animation: `fadeIn 0.5s ease-out ${index * 0.05}s both`
                                    }}>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                            {formatTimestamp(record.created_at)}
                                        </td>
                                        <td style={{ 
                                            padding: '1rem', 
                                            maxWidth: '200px', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.9rem'
                                        }} title={record.original_filename || undefined}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }}>
                                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                                    <polyline points="13 2 13 9 20 9"></polyline>
                                                </svg>
                                                {record.original_filename || '-'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                            {getStatusDisplay(record.processing_status)}
                                        </td>
                                        <td style={{ 
                                            padding: '1rem', 
                                            fontSize: '0.9rem',
                                            fontWeight: record.recommendation ? '500' : '400',
                                            color: record.recommendation ? 
                                                (record.recommendation.includes('INVEST') ? 'var(--success)' : 
                                                record.recommendation.includes('HOLD') || record.recommendation.includes('WAIT') ? 'var(--warning)' : 
                                                'var(--error)') 
                                                : 'var(--text-muted)'
                                        }}>
                                            {record.recommendation || '-'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                            {record.overall_score !== null ? (
                                                <div style={{ 
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    fontWeight: '600',
                                                    color: getScoreColor(record.overall_score)
                                                }}>
                                                    {record.overall_score}
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        marginLeft: '2px',
                                                        opacity: 0.8,
                                                        fontWeight: 'normal'
                                                    }}>/100</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                            {record.processing_status?.toUpperCase() === 'COMPLETED' && record.pdf_s3_key ? (
                                                <button 
                                                    onClick={() => handleDownload(record.id)} 
                                                    disabled={downloadingId === record.id} 
                                                    style={{ 
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        backgroundColor: 'var(--primary-color)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontWeight: '500',
                                                        fontSize: '0.85rem',
                                                        cursor: downloadingId === record.id ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        boxShadow: '0 2px 5px rgba(var(--primary-color-rgb), 0.2)'
                                                    }}
                                                >
                                                    {downloadingId === record.id ? (
                                                        <LoadingSpinner size="12px" color="white" />
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    )}
                                                    Download
                                                </button>
                                            ) : (
                                                <span style={{ 
                                                    color: 'var(--text-muted)', 
                                                    fontSize: '0.85rem', 
                                                    fontStyle: 'italic' 
                                                }}>Unavailable</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                            {/* Email status display */}
                                            {record.processing_status?.toUpperCase() === 'COMPLETED' && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 500,
                                                    color: record.email_status === 'SENT' ? 'var(--success)' : 'var(--warning)',
                                                    background: record.email_status === 'SENT' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                                    borderRadius: 'var(--radius-full)',
                                                    padding: '2px 10px',
                                                    marginLeft: '0.5rem'
                                                }}>
                                                    {record.email_status === 'SENT' ? (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 6 12 17 2 6"></polyline></svg>
                                                            Email sent!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            Email not sent!
                                                        </>
                                                    )}
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteClick(record.id)} 
                                                disabled={deletingId === record.id} 
                                                style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    backgroundColor: 'var(--error)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: '500',
                                                    fontSize: '0.85rem',
                                                    cursor: deletingId === record.id ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.2)'
                                                }}
                                            >
                                                {deletingId === record.id ? (
                                                    <LoadingSpinner size="12px" color="white" />
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
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
            
            <ConfirmDeleteModal 
                isOpen={confirmDeleteModalOpen} 
                recordId={recordToDelete} 
                onConfirm={deleteRecord} 
                onCancel={handleCancelDelete} 
            />
        </div>
    );
};

export default UserDashboard;

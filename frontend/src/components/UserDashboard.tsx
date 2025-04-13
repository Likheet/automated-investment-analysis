import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface AnalysisRecord {
    id: number;
    s3_key: string;
    original_filename: string | null;
    pdf_s3_key: string | null;
    overall_score: number | null;
    recommendation: string | null;
    processing_status: string;
    created_at: string;
}

const LoadingSpinner: React.FC = () => (
    <div style={{ display: 'inline-block', border: '2px solid rgba(0, 0, 0, 0.1)', borderLeftColor: '#007bff', borderRadius: '50%', width: '12px', height: '12px', marginRight: '5px', animation: 'spin 1s linear infinite' }}></div>
);

// Custom modal for delete confirmation
const ConfirmDeleteModal: React.FC<{
    isOpen: boolean;
    recordId: number | null;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, recordId, onConfirm, onCancel }) => {
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
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                width: '90%',
                maxWidth: '400px',
                boxShadow: 'var(--shadow-lg)',
            }}>
                <h3 style={{ marginTop: 0 }}>Confirm Deletion</h3>
                <p>Are you sure you want to delete this record (ID: {recordId})? This action cannot be undone.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button 
                        onClick={onCancel}
                        style={{ 
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-medium)',
                            backgroundColor: 'var(--bg-light)',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        style={{ 
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--error)',
                            backgroundColor: 'var(--error)',
                            color: 'white',
                            cursor: 'pointer',
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

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

    const fetchHistory = useCallback(async () => {
        setError('');
        if (!token) { setError("Authentication token not found."); setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            
            // First, delete any records with FILE_UNAVAILABLE status
            try {
                const deleteResponse = await axios.delete('http://localhost:5001/api/analysis/history/unavailable', config);
                if (deleteResponse.data.removedCount > 0) {
                    console.log(`Removed ${deleteResponse.data.removedCount} unavailable records`);
                }
            } catch (deleteErr) {
                console.error("Failed to remove unavailable records:", deleteErr);
                // Continue with fetching history even if deletion fails
            }
            
            // Then fetch the updated history
            const response = await axios.get('http://localhost:5001/api/analysis/history', config);
            setHistory(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            console.error("Failed to fetch analysis history:", err);
            setError(err.response?.data?.message || "Failed to load analysis history.");
            setHistory([]);
        } finally { setIsLoading(false); }
    }, [token]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Filter out any FILE_UNAVAILABLE records from history
    const filteredHistory = history.filter(record => 
        record.processing_status?.toUpperCase() !== 'FILE_UNAVAILABLE'
    );

    const handleDownload = async (analysisId: number) => {
        if (!token) { setError("Not authenticated."); return; }
        setError('');
        setDownloadingId(analysisId);
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const response = await axios.get(`http://localhost:5001/api/analysis/report/${analysisId}/download`, config);
            
            if (response.data && response.data.downloadUrl) {
                window.location.href = response.data.downloadUrl;
            } else {
                console.error("No download URL in response:", response);
                setError("Could not get download link. No URL provided.");
            }
        } catch (err: any) {
            console.error(`Error downloading report ID ${analysisId}:`, err);
            
            // Check if this is a file deleted error
            if (err.response?.data?.errorType === 'FILE_DELETED') {
                // Remove the unavailable record from the UI immediately
                setHistory(prevHistory => 
                    prevHistory.filter(record => record.id !== analysisId)
                );
                setError('The report file has been deleted from storage and is no longer available. It has been removed from your history.');
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

    const handleDeleteClick = (analysisId: number) => {
        setRecordToDelete(analysisId);
        setConfirmDeleteModalOpen(true);
    };

    const handleCancelDelete = () => {
        setConfirmDeleteModalOpen(false);
        setRecordToDelete(null);
    };

    const deleteRecord = async () => {
        if (!token || recordToDelete === null) { 
            setError("Not authenticated or invalid record ID.");
            setConfirmDeleteModalOpen(false);
            setRecordToDelete(null);
            return; 
        }
        
        const analysisId = recordToDelete;
        
        setError('');
        setSuccessMessage('');
        setConfirmDeleteModalOpen(false);
        setDeletingId(analysisId);
        
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            await axios.delete(`http://localhost:5001/api/analysis/record/${analysisId}`, config);
            
            // Remove the deleted record from the local state
            setHistory(prevHistory => 
                prevHistory.filter(record => record.id !== analysisId)
            );
            setSuccessMessage('Record deleted successfully.');
            
            // Clear the success message after 3 seconds
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error(`Error deleting record ID ${analysisId}:`, err);
            setError(err.response?.data?.message || `Failed to delete record (Status: ${err.response?.status || 'unknown'}).`);
        } finally {
            setDeletingId(null);
            setRecordToDelete(null);
        }
    };

    const formatTimestamp = (timestamp: string | null | undefined): string => {
        if (!timestamp) return "Invalid date";
        try {
            const dateObject = new Date(timestamp);
            if (isNaN(dateObject.getTime())) return "Invalid date";
            return format(dateObject, 'dd MMM yyyy, HH:mm');
        } catch { return "Invalid date"; }
    };

    const getStatusDisplay = (status: string | null | undefined): React.ReactNode => {
        const upperStatus = status?.toUpperCase();
        switch (upperStatus) {
            case 'COMPLETED': return <span style={{ color: 'green' }}>Completed</span>;
            case 'PENDING': return <span style={{ color: 'orange' }}>Pending</span>;
            case 'UPLOADING_DECK': case 'EXTRACTING_TEXT': case 'ANALYZING_AI':
            case 'SAVING_ANALYSIS': case 'GENERATING_PDF': case 'UPLOADING_PDF':
                return <span style={{ color: 'blue' }}>Processing...</span>;
            case 'FAILED': return <span style={{ color: 'red' }}>Failed</span>;
            case 'FILE_UNAVAILABLE': return <span style={{ color: 'red', fontStyle: 'italic' }}>File Unavailable</span>;
            default: return <span style={{ color: 'grey' }}>{status || 'Unknown'}</span>;
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '1rem' }}>
            <h2>Analysis History</h2>
            {isLoading && <p>Loading history...</p>}
            {error && (
                <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    {error}
                </div>
            )}
            {successMessage && (
                <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    {successMessage}
                </div>
            )}
            {!isLoading && filteredHistory.length === 0 && !error && (<p>No analysis history found.</p>)}
            {!isLoading && filteredHistory.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Uploaded At</th>
                            <th style={{ padding: '8px' }}>Original Filename</th>
                            <th style={{ padding: '8px' }}>Status</th>
                            <th style={{ padding: '8px' }}>Recommendation</th>
                            <th style={{ padding: '8px' }}>Score</th>
                            <th style={{ padding: '8px' }}>Report</th>
                            <th style={{ padding: '8px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHistory.map((record) => (
                            <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px' }}>{formatTimestamp(record.created_at)}</td>
                                <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.original_filename || undefined}>
                                    {record.original_filename || '-'}
                                </td>
                                <td style={{ padding: '8px' }}>{getStatusDisplay(record.processing_status)}</td>
                                <td style={{ padding: '8px' }}>{record.recommendation || '-'}</td>
                                <td style={{ padding: '8px' }}>{record.overall_score !== null ? `${record.overall_score} / 100` : '-'}</td>
                                <td style={{ padding: '8px' }}>
                                    {record.processing_status?.toUpperCase() === 'COMPLETED' && record.pdf_s3_key ? (
                                        <button onClick={() => handleDownload(record.id)} disabled={downloadingId === record.id} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                                            {downloadingId === record.id ? (<> <LoadingSpinner /> Downloading...</>) : 'Download PDF'}
                                        </button>
                                    ) : record.processing_status?.toUpperCase() === 'FAILED' ? (
                                        <span style={{ color: 'red', fontStyle: 'italic' }}>Not Available</span>
                                    ) : (<span style={{ color: 'grey', fontStyle: 'italic' }}>Processing...</span>)}
                                </td>
                                <td style={{ padding: '8px' }}>
                                    <button 
                                        onClick={() => handleDeleteClick(record.id)} 
                                        disabled={deletingId === record.id}
                                        title="Delete this record"
                                        style={{ 
                                            padding: '5px 8px',
                                            cursor: 'pointer',
                                            backgroundColor: 'transparent',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-secondary)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                            e.currentTarget.style.borderColor = 'var(--error)';
                                            e.currentTarget.style.color = 'var(--error)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                        }}
                                    >
                                        {deletingId === record.id ? (
                                            <> 
                                                <LoadingSpinner /> 
                                                <span style={{ marginLeft: '5px' }}>Deleting...</span>
                                            </>
                                        ) : (
                                            <> 
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '5px' }}>
                                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                                </svg>
                                                Delete
                                            </>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <button 
                onClick={fetchHistory} 
                disabled={isLoading} 
                className="btn btn-primary"
                style={{ 
                    marginTop: '1.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    backgroundColor: isLoading ? '#d1d5db' : '#007bff',
                    color: isLoading ? '#6b7280' : 'white',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.3s ease, color 0.3s ease'
                }}
                onMouseOver={(e) => {
                    if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#0056b3';
                    }
                }}
                onMouseOut={(e) => {
                    if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#007bff';
                    }
                }}
            >
                {isLoading ? (
                    <>
                        <div className="loading-spinner" style={{
                            width: '1rem', 
                            height: '1rem', 
                            borderWidth: '2px', 
                            margin: '0 var(--spacing-xs) 0 0',
                            border: '2px solid rgba(0, 0, 0, 0.1)',
                            borderLeftColor: '#007bff',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Refreshing...
                    </>
                ) : 'Refresh History'}
            </button>
            <ConfirmDeleteModal 
                isOpen={confirmDeleteModalOpen} 
                recordId={recordToDelete} 
                onConfirm={deleteRecord} 
                onCancel={handleCancelDelete} 
            />
            <style>{` @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } `}</style>
        </div>
    );
};

export default UserDashboard;
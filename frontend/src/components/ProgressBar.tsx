// frontend/src/components/ProgressBar.tsx (New file)
import React from 'react';

interface ProgressBarProps {
    status: string | null; // The current status string from backend
}

// Estimate progress based on status string (adjust stages/percentages as needed)
const calculateProgress = (status: string | null): number => {
    if (!status) return 0;
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
        case 'PENDING': return 5;
        case 'UPLOADING_DECK': return 10;
        case 'EXTRACTING_TEXT': return 25;
        case 'ANALYZING_AI': return 50; // AI is usually the longest step
        case 'SAVING_ANALYSIS': return 80;
        case 'GENERATING_PDF': return 85;
        case 'UPLOADING_PDF': return 95;
        case 'COMPLETED': return 100;
        case 'FAILED': return 100; // Show full bar but indicate failure elsewhere
        default: return 0;
    }
};

const ProgressBar: React.FC<ProgressBarProps> = ({ status }) => {
    const progress = calculateProgress(status);
    const displayStatus = status ? status.replace(/_/g, ' ').toLowerCase() : 'Initializing...';

    return (
        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.5rem', fontStyle: 'italic', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                Status: {status?.toUpperCase() === 'FAILED' ? <span style={{color: 'var(--error)'}}>Failed</span> : displayStatus}
            </div>
            <div style={{ width: '100%', backgroundColor: 'var(--border-light)', borderRadius: 'var(--radius-full)', overflow: 'hidden', height: '10px' }}>
                <div style={{
                    width: `${progress}%`,
                    backgroundColor: status?.toUpperCase() === 'FAILED' ? 'var(--error)' : 'var(--primary-color)',
                    height: '10px',
                    textAlign: 'center',
                    lineHeight: '10px',
                    color: 'white',
                    fontSize: '8px',
                    transition: 'width 0.5s ease-in-out',
                    borderRadius: 'var(--radius-full)'
                }}>
                </div>
            </div>
        </div>
    );
};

export default ProgressBar;
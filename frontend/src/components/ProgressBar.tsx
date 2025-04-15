// frontend/src/components/ProgressBar.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ProgressBarProps {
    status: string | null; // The current status string from backend
    onComplete?: () => void; // Optional callback when completed
    analysisId?: number | null; // Not used but included in the interface for compatibility
    onRefresh?: () => void; // New prop for refresh functionality
}

// Define the stages and their exact weight percentages based on processing time
// Adjusted for more detailed steps as seen in the backend logs
const PROCESS_STAGES = [
    { status: 'PENDING', weight: 2, label: 'Initializing analysis...' },
    { status: 'UPLOADING_DECK', weight: 8, label: 'Uploading presentation...' },
    // Add more detailed steps within each main stage
    { status: 'EXTRACTING_TEXT', substeps: [
        { label: 'Extracting text from slides...', progress: 15 },
        { label: 'Processing slide content...', progress: 20 },
        { label: 'Parsing visual elements...', progress: 25 }
    ], weight: 15, label: 'Extracting content...' },
    { status: 'ANALYZING_AI', substeps: [
        { label: 'Analyzing business model...', progress: 30 },
        { label: 'Evaluating market potential...', progress: 40 },
        { label: 'Assessing team capabilities...', progress: 50 },
        { label: 'Calculating risk factors...', progress: 60 },
        { label: 'Forming investment recommendation...', progress: 70 }
    ], weight: 40, label: 'AI analyzing pitch deck...' },
    { status: 'SAVING_ANALYSIS', weight: 10, label: 'Saving analysis results...' },
    { status: 'GENERATING_PDF', weight: 10, label: 'Generating PDF report...' },
    { status: 'UPLOADING_PDF', weight: 10, label: 'Finalizing report...' },
    { status: 'COMPLETED', weight: 5, label: 'Analysis completed!' }
] as const satisfies readonly {
    status: string;
    weight: number;
    label: string;
    substeps?: Array<{
        label: string;
        progress: number;
    }>;
}[];

// Calculate cumulative progress points where each stage starts
const STAGE_PROGRESS_POINTS: Record<string, number> = {};
let cumulativeProgress = 0;
PROCESS_STAGES.forEach(stage => {
    STAGE_PROGRESS_POINTS[stage.status] = cumulativeProgress;
    cumulativeProgress += stage.weight;
});

const ProgressBar: React.FC<ProgressBarProps> = ({ status, onComplete, onRefresh }) => {
    const { theme } = useTheme();
    const [progress, setProgress] = useState(0);
    const [targetProgress, setTargetProgress] = useState(0);
    const [stageLabel, setStageLabel] = useState('Initializing...');
    const [currentStage, setCurrentStage] = useState<string | null>(null);
    const stageTimerRef = useRef<NodeJS.Timeout | null>(null);
    const completionDelayRef = useRef<NodeJS.Timeout | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);

    // Find label for the current status
    const getStageLabel = useCallback((status: string | null): string => {
        if (!status) return 'Initializing...';

        const upperStatus = status.toUpperCase();
        const stage = PROCESS_STAGES.find(s => s.status === upperStatus);

        if (upperStatus === 'FAILED') return 'Analysis failed';

        // Check if there are substeps for this stage and return the appropriate substep label
        if (stage && 'substeps' in stage && stage.substeps && Array.isArray(stage.substeps)) {
            return stage.substeps[0].label;
        }

        return stage?.label || 'Processing...';
    }, []);

    // Function to advance through substeps within a stage
    const progressThroughSubsteps = useCallback((status: string) => {
        const upperStatus = status.toUpperCase();
        const stage = PROCESS_STAGES.find(s => s.status === upperStatus);

        if (!stage || !('substeps' in stage) || !stage.substeps || (stage.substeps.length as number) === 0) {
            return;
        }

        // Clear any existing timer
        if (stageTimerRef.current) {
            clearTimeout(stageTimerRef.current);
            stageTimerRef.current = null;
        }

        // Set up stepping through substeps
        let step = 0;

        const advanceSubstep = () => {
            if (!('substeps' in stage) || !stage.substeps || step >= stage.substeps.length) return;

            // Update label
            setStageLabel(getStageLabel(status));

            // Update progress based on substep
            const substep = stage.substeps[step];
            setTargetProgress(substep.progress);

            step++;

            // Schedule next substep if not at end
            if (step < stage.substeps.length) {
                // Time between substeps depends on the stage
                // AI analysis takes longer, so space out updates
                const delay = upperStatus === 'ANALYZING_AI' ? 5000 : 2000;
                stageTimerRef.current = setTimeout(advanceSubstep, delay);
            }
        };

        // Start the process
        advanceSubstep();
    }, [getStageLabel]);

    // Calculate the target progress based on current status
    useEffect(() => {
        if (!status) {
            setTargetProgress(0);
            setStageLabel('Initializing...');
            return;
        }

        const upperStatus = status.toUpperCase();

        console.log(`Progress Bar: Status update to ${upperStatus}`);

        // If we get a new status, clear any running substep timers
        if (upperStatus !== currentStage) {
            if (stageTimerRef.current) {
                clearTimeout(stageTimerRef.current);
                stageTimerRef.current = null;
            }

            if (completionDelayRef.current) {
                clearTimeout(completionDelayRef.current);
                completionDelayRef.current = null;
            }
        }

        if (upperStatus === currentStage) {
            console.log(`Still in stage ${upperStatus}, not updating progress target`);
            return; // Still in same stage, don't update
        }

        setCurrentStage(upperStatus);

        // Calculate progress based on current stage
        let progressTarget = 0;

        if (upperStatus === 'COMPLETED') {
            // For COMPLETED status, add a delay with intermediate progress steps
            // instead of jumping straight to 100%

            // Start at 80% (assuming the previous stage got us close to completion)
            progressTarget = 80;
            setStageLabel('Finalizing report...');
            setTargetProgress(progressTarget);

            // Set up completion delay sequence
            const simulateCompletion = () => {
                // Sequence of steps with random values between 85-95% before reaching 100%
                const steps = [
                    { progress: Math.floor(Math.random() * 6) + 85, label: 'Formatting charts and tables...', delay: 800 },
                    { progress: Math.floor(Math.random() * 4) + 90, label: 'Optimizing PDF quality...', delay: 1000 },
                    { progress: Math.floor(Math.random() * 3) + 96, label: 'Preparing final document...', delay: 800 },
                    { progress: 100, label: 'Analysis completed!', delay: 1500 }
                ];

                let stepIndex = 0;

                const processStep = () => {
                    if (stepIndex >= steps.length) {
                        // This is critical - call onComplete to clear the progress bar
                        if (onComplete) {
                            onComplete();
                        }
                        return;
                    }

                    const step = steps[stepIndex];
                    setTargetProgress(step.progress);
                    setStageLabel(step.label);

                    stepIndex++;
                    if (stepIndex < steps.length) {
                        completionDelayRef.current = setTimeout(processStep, step.delay);
                    } else if (onComplete) {
                        // When we reach the last step, set a timeout to call onComplete
                        completionDelayRef.current = setTimeout(() => {
                            if (onComplete) onComplete();
                        }, step.delay);
                    }
                };

                processStep();
            };

            // Start the completion sequence after a short delay
            completionDelayRef.current = setTimeout(simulateCompletion, 500);

            return; // Exit early to handle completion sequence separately
        } else if (upperStatus === 'FAILED') {
            progressTarget = 100; // Show full bar for failed status too
            setStageLabel('Analysis failed');
        } else {
            // Get progress for current stage
            progressTarget = STAGE_PROGRESS_POINTS[upperStatus] || 0;
            setStageLabel(getStageLabel(status));

            // For stages with substeps, start the substep progress
            const stage = PROCESS_STAGES.find(s => s.status === upperStatus);
            if (stage && 'substeps' in stage && stage.substeps && Array.isArray(stage.substeps) && stage.substeps.length > 0) {
                // Start with initial progress and then advance through substeps
                progressTarget = stage.substeps[0].progress;

                // Start advancing through substeps after a short delay
                setTimeout(() => progressThroughSubsteps(upperStatus), 1000);
            } else {
                // Add partial progress within the stage itself (animate up to 80% of stage weight)
                if (stage) {
                    progressTarget += Math.floor(stage.weight * 0.6);
                }
            }
        }

        console.log(`Set target progress to ${progressTarget} for stage ${upperStatus}`);
        setTargetProgress(progressTarget);

    }, [status, onComplete, getStageLabel, currentStage, progressThroughSubsteps]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (stageTimerRef.current) {
                clearTimeout(stageTimerRef.current);
            }
            if (completionDelayRef.current) {
                clearTimeout(completionDelayRef.current);
            }
        };
    }, []);

    // Smoothly animate progress toward target
    useEffect(() => {
        if (progress === targetProgress) return;

        // For smoother animation, approach the target progressively
        const animationInterval = setInterval(() => {
            setProgress(prev => {
                // Move faster toward the beginning of a new stage
                const increment = targetProgress - prev > 10 ? 2 : 0.5;
                const nextProgress = Math.min(prev + increment, targetProgress);

                if (nextProgress >= targetProgress) {
                    clearInterval(animationInterval);
                }

                return nextProgress;
            });
        }, 50);

        return () => clearInterval(animationInterval);
    }, [targetProgress, progress]);

    // Handle refresh click
    const handleRefreshClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRefresh) {
            onRefresh();
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
                    ) : status?.toUpperCase() === 'FAILED' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    )}
                    <span 
                        style={{ 
                            color: status?.toUpperCase() === 'FAILED' ? 'var(--error)' : 
                                  status?.toUpperCase() === 'COMPLETED' ? 'var(--success)' : 'var(--text-primary)'
                        }}
                    >
                        {stageLabel}
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{
                        color: status?.toUpperCase() === 'FAILED' ? 'var(--error)' : 
                               status?.toUpperCase() === 'COMPLETED' ? 'var(--success)' : 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        minWidth: '40px',
                        textAlign: 'right'
                    }}>
                        {Math.round(progress)}%
                    </div>
                    
                    {/* Refresh button with enhanced design */}
                    {(status?.toUpperCase() === 'FAILED' || status?.toUpperCase() === 'COMPLETED') && onRefresh && (
                        <button 
                            onClick={handleRefreshClick}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            onMouseDown={() => setIsActive(true)}
                            onMouseUp={() => setIsActive(false)}
                            onTouchStart={() => setIsActive(true)}
                            onTouchEnd={() => setIsActive(false)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isActive 
                                    ? 'var(--primary-color)'
                                    : isHovered 
                                    ? theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)' 
                                    : 'transparent',
                                border: `1px solid ${isActive || isHovered ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '8px',
                                minWidth: '32px',
                                minHeight: '32px',
                                cursor: 'pointer',
                                color: isActive 
                                    ? 'white'
                                    : isHovered 
                                    ? 'var(--primary-color)' 
                                    : 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                boxShadow: isActive 
                                    ? 'inset 0 2px 4px rgba(0, 0, 0, 0.15)' 
                                    : isHovered 
                                    ? '0 2px 4px rgba(0, 0, 0, 0.1)' 
                                    : 'none',
                                transform: isActive ? 'translateY(1px)' : 'none',
                                position: 'relative',
                                zIndex: 5
                            }}
                            title="Restart analysis"
                            aria-label="Restart analysis"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{
                                    animation: isHovered ? 'rotate-refresh 1s ease-in-out' : 'none'
                                }}
                            >
                                <path d="M3 2v6h6"></path>
                                <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
                                <path d="M21 22v-6h-6"></path>
                                <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div style={{
                height: '8px',
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: status?.toUpperCase() === 'FAILED' ? 'var(--error)' : 
                                    progress === 100 ? 'var(--success)' : 'var(--primary-color)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.3s ease-out, background-color 0.5s ease',
                    boxShadow: '0 0 5px rgba(var(--primary-color-rgb), 0.3)'
                }}></div>
                
                {/* Markers for key progress stages */}
                {Object.entries(STAGE_PROGRESS_POINTS).map(([stageName, stageProgress]) => (
                    stageProgress > 0 && stageProgress < 100 && (
                        <div 
                            key={stageName}
                            style={{
                                position: 'absolute',
                                left: `${stageProgress}%`,
                                top: '0',
                                height: '100%',
                                width: '2px',
                                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                                transform: 'translateX(-1px)'
                            }}
                        />
                    )
                ))}
            </div>
            
            {progress < 100 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}>
                    <p style={{ margin: '0', fontStyle: 'italic' }}>
                        This may take a few minutes depending on the complexity of your pitch deck
                    </p>
                    
                    {/* Timeline markers showing key processing phases */}
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        gap: '3px'
                    }}>
                        <span 
                            title="Upload"
                            style={{ 
                                position: 'relative', 
                                opacity: progress >= STAGE_PROGRESS_POINTS['UPLOADING_DECK'] ? 0.9 : 0.4
                            }}
                        >📤</span>
                        <span 
                            title="Extract"
                            style={{ 
                                position: 'relative', 
                                opacity: progress >= STAGE_PROGRESS_POINTS['EXTRACTING_TEXT'] ? 0.9 : 0.4
                            }}
                        >📑</span>
                        <span 
                            title="AI Analysis"
                            style={{ 
                                position: 'relative',
                                opacity: progress >= STAGE_PROGRESS_POINTS['ANALYZING_AI'] ? 0.9 : 0.4
                            }}
                        >🧠</span>
                        <span 
                            title="PDF Generation"
                            style={{ 
                                position: 'relative',
                                opacity: progress >= STAGE_PROGRESS_POINTS['GENERATING_PDF'] ? 0.9 : 0.4
                            }}
                        >📄</span>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes rotate-refresh {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes highlight-new-analysis {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(var(--primary-color-rgb), 0.2); }
                }
            `}</style>
        </div>
    );
};

export default ProgressBar;

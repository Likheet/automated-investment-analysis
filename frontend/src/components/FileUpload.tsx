// frontend/src/components/FileUpload.tsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const FileUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setMessage('');
    setSelectedFile(null);

    if (file) {
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
    }
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

    setIsLoading(true);
    setMessage(`Uploading ${selectedFile.name}...`);
    setMessageType('info');

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

      setMessage(`${response.data.message || 'Upload and processing successful!'}. Analysis ID: ${response.data.analysisId}`);
      setMessageType('success');
      setSelectedFile(null);
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
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container">
      <div className="card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
        <div className="card-header" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <h2 style={{margin: 0}}>Upload Pitch Deck for Analysis</h2>
        </div>
        <div className="card-body">
          <p className="mb-2">Upload your presentation to get an automated investment analysis.</p>
          
          <div className="flex md-row items-center gap-2 mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              key={selectedFile?.name + '-' + selectedFile?.lastModified || 'empty'}
              disabled={isLoading}
              style={{ display: 'none' }}
            />
            
            <button 
              className="btn"
              onClick={triggerFileInput} 
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Select File
            </button>
            
            <button 
              className="btn btn-primary"
              onClick={handleUpload} 
              disabled={!selectedFile || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)'
              }}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner" style={{width: '1rem', height: '1rem', borderWidth: '2px', margin: '0 var(--spacing-xs) 0 0'}}></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Analyze Deck
                </>
              )}
            </button>
          </div>
          
          {message && (
            <div style={{
              backgroundColor: 
                messageType === 'success' ? 'var(--success-bg, rgba(16, 185, 129, 0.1))' : 
                messageType === 'error' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : 
                'var(--info-bg, rgba(59, 130, 246, 0.1))',
              color: 
                messageType === 'success' ? 'var(--success)' : 
                messageType === 'error' ? 'var(--error)' : 
                'var(--info)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              marginTop: 'var(--spacing-md)'
            }}>
              {message}
            </div>
          )}

          {selectedFile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              marginTop: 'var(--spacing-md)',
              color: 'var(--text-primary)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div>
                <div style={{fontWeight: 500}}>{selectedFile.name}</div>
                <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
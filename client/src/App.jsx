import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileRenameBuilder } from '@/components/FileRenameBuilder';
// import { ModelTrainingPage } from '@/pages/ModelTraining';
// import { OngoingTraining } from '@/components/ModelTraining/OngoingTraining';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { countPDFPages } from '@/lib/pdf-utils';
import { API_URL, fetchWithAuth } from '@/config/api';
import { 
  Upload, 
  FileText, 
  CreditCard, 
  AlertCircle, 
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  FileCheck,
  Zap,
  BarChart3,
  Brain,
  FileWarning,
  LogOut,
  FastForward,
  RefreshCw
} from 'lucide-react';

// Helper function to format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'just now';
};

// Helper function to format time remaining
const formatTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  
  if (diffMs <= 0) return 'Expired';
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  if (diffMins > 0) return `${diffMins}m`;
  return 'Soon';
};

// Helper function to check if session is expired
const isSessionExpired = (expiresAt) => {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
};

// Helper function to check if session is expiring soon (within 5 minutes)
const isExpiringSoon = (expiresAt) => {
  if (!expiresAt) return false;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  return diffMs > 0 && diffMs <= 5 * 60 * 1000; // 5 minutes
};

function App() {
  const { user, logout, token, updateCredits } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  // const [showModelTraining, setShowModelTraining] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Silvi_Reader_Full_2.0');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filePageCounts, setFilePageCounts] = useState({});
  const [modelFields, setModelFields] = useState(null);
  
  // Session management
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionProgress, setSessionProgress] = useState({ current: 0, total: 0, status: 'idle' });
  const [postProcessingStatus, setPostProcessingStatus] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Pagination and filtering states - moved here before fetchUserSessions
  const [allUserSessions, setAllUserSessions] = useState([]); // Store all sessions
  const [userSessions, setUserSessions] = useState([]); // Filtered sessions to display
  const [sessionFilter, setSessionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const sessionsPerPage = 5;
  
  // Speed up expiration state
  const [speedingUpSessions, setSpeedingUpSessions] = useState(new Set());
  
  // Real-time expiration tracking
  const [expiredSessions, setExpiredSessions] = useState(new Set());
  
  // Download status for showing in session table
  const [downloadingSessions, setDownloadingSessions] = useState(new Set());
  const [expirationCheckInterval, setExpirationCheckInterval] = useState(null);
  
  // Development tier info
  const [tierInfo, setTierInfo] = useState(null);
  
  // Session loading states
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [hasSessionsCheck, setHasSessionsCheck] = useState(null); // null = not checked, true/false = result

  // Quick check if user has any sessions
  const checkHasSessions = async () => {
    if (!token) return;
    
    try {
      // Quick check - just get count or first session
      const url = new URL(`${API_URL}/api/jobs/sessions`);
      url.searchParams.append('limit', 1);
      url.searchParams.append('offset', 0);
      
      const response = await fetchWithAuth(url.toString());
      
      if (response.ok) {
        const data = await response.json();
        const hasSessions = data.sessions && data.sessions.length > 0;
        setHasSessionsCheck(hasSessions);
        return hasSessions;
      }
    } catch (error) {
      console.error('Error checking for sessions:', error);
    }
    
    setHasSessionsCheck(false);
    return false;
  };

  // Fetch all user sessions (only called once or on refresh)
  const fetchAllUserSessions = async () => {
    if (!token) return;
    
    setSessionsLoading(true);
    
    try {
      // Fetch all sessions without pagination
      const url = new URL(`${API_URL}/api/jobs/sessions`);
      url.searchParams.append('limit', 1000); // Get all sessions
      url.searchParams.append('offset', 0);

      const response = await fetchWithAuth(url.toString());
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Frontend] Fetched all sessions from server:', data.sessions);
        setAllUserSessions(data.sessions);
        
        // Apply initial filter and pagination
        applyFilterAndPagination(data.sessions, sessionFilter, currentPage);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Apply client-side filtering and pagination
  const applyFilterAndPagination = (sessions, filter, page) => {
    // Include currentSession if it exists and is not already in the list
    let allSessionsWithCurrent = [...sessions];
    if (currentSession && sessionProgress.status !== 'idle') {
      // Check if currentSession is already in the list
      const existingIndex = sessions.findIndex(s => 
        s.id === currentSession.id || 
        s.id === currentSession.serverId ||
        s.id === currentSession.clientId
      );
      
      // If not found, add it to the beginning
      if (existingIndex === -1) {
        const currentSessionData = {
          ...currentSession,
          status: sessionProgress.status === 'processing' ? 'PROCESSING' : sessionProgress.status,
          processedPages: sessionProgress.current,
          totalPages: sessionProgress.total,
        };
        allSessionsWithCurrent = [currentSessionData, ...sessions];
      }
    }
    
    // Filter sessions based on status
    let filteredSessions = allSessionsWithCurrent;
    
    if (filter !== 'all') {
      const statusMap = {
        'completed': ['COMPLETED'],
        'failed': ['FAILED'],
        'processing': ['ACTIVE', 'UPLOADING', 'PROCESSING']
      };
      
      const allowedStatuses = statusMap[filter] || [];
      filteredSessions = allSessionsWithCurrent.filter(session => 
        allowedStatuses.includes(session.status)
      );
    }

    // Don't exclude current session - we want to show it in the table
    // Update total count
    setTotalSessions(filteredSessions.length);

    // Apply pagination
    const startIndex = (page - 1) * sessionsPerPage;
    const endIndex = startIndex + sessionsPerPage;
    const paginatedSessions = filteredSessions.slice(startIndex, endIndex);
    
    setUserSessions(paginatedSessions);
  };

  // Fetch all sessions only when user logs in - two-step approach
  useEffect(() => {
    if (user && token) {
      // First, quickly check if user has any sessions
      checkHasSessions().then(hasSessions => {
        if (hasSessions) {
          // If they have sessions, then fetch all of them
          fetchAllUserSessions();
        }
      });
    }
  }, [user, token]);
  
  // Fetch tier info in development
  useEffect(() => {
    const fetchTierInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/tier-info`);
        if (response.ok) {
          const data = await response.json();
          setTierInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch tier info:', error);
      }
    };
    
    // Only fetch in development
    if (import.meta.env.MODE === 'development') {
      fetchTierInfo();
    }
  }, []);
  
  // Real-time expiration checking
  useEffect(() => {
    // Check for expired sessions every 30 seconds
    const checkExpiredSessions = () => {
      const now = new Date();
      const newExpiredSessions = new Set();
      
      // Check all sessions for expiration
      allUserSessions.forEach(session => {
        if (new Date(session.expiresAt) <= now) {
          newExpiredSessions.add(session.id);
        }
      });
      
      // If any new sessions expired, update state and refresh
      if (newExpiredSessions.size !== expiredSessions.size) {
        setExpiredSessions(newExpiredSessions);
        // Refresh sessions from server to get updated status
        checkHasSessions().then(hasSessions => {
          if (hasSessions) {
            fetchAllUserSessions();
          }
        });
      }
    };
    
    // Check immediately
    checkExpiredSessions();
    
    // Set up interval
    const interval = setInterval(checkExpiredSessions, 30000); // Every 30 seconds
    setExpirationCheckInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [allUserSessions, expiredSessions]);

  // Apply filters and pagination when they change (client-side only)
  useEffect(() => {
    if (allUserSessions.length > 0 || currentSession) {
      applyFilterAndPagination(allUserSessions, sessionFilter, currentPage);
    }
  }, [sessionFilter, currentPage, currentSession, sessionProgress, allUserSessions]);

  // Session recovery from localStorage
  useEffect(() => {
    const storedSession = localStorage.getItem('activeSession');
    console.log('[Frontend] Checking localStorage for active session:', storedSession);
    
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        console.log('[Frontend] Parsed session from localStorage:', session);
        
        // Validate session has required fields
        if (!session.createdAt || !session.id) {
          console.log('[Frontend] Invalid session found (missing fields), removing from localStorage');
          localStorage.removeItem('activeSession');
          return;
        }
        
        // Check if session is not expired (24 hours)
        const sessionDate = new Date(session.createdAt);
        if (isNaN(sessionDate.getTime())) {
          console.log('[Frontend] Invalid session date, removing from localStorage');
          localStorage.removeItem('activeSession');
          return;
        }
        
        const now = new Date();
        const hoursDiff = (now - sessionDate) / (1000 * 60 * 60);
        console.log(`[Frontend] Session age: ${hoursDiff} hours`);
        
        if (hoursDiff < 24) {
          console.log('[Frontend] Setting current session:', session);
          setCurrentSession(session);
          // Check session status from server
          checkSessionStatus(session.serverId || session.id);
        } else {
          // Session expired, remove from localStorage
          console.log('[Frontend] Session expired, removing from localStorage');
          localStorage.removeItem('activeSession');
        }
      } catch (error) {
        console.error('[Frontend] Error parsing stored session:', error);
        localStorage.removeItem('activeSession');
      }
    }
  }, []);

  // Track last known credits to avoid unnecessary updates
  const [lastKnownCredits, setLastKnownCredits] = useState(null);
  
  // Initialize last known credits when user loads
  useEffect(() => {
    if (user?.credits !== undefined && lastKnownCredits === null) {
      setLastKnownCredits(user.credits);
    }
  }, [user?.credits]);
  
  // Check session status from server
  const checkSessionStatus = async (sessionId) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/jobs/session/${sessionId}/status`);
      const data = await response.json();
      
      if (response.ok) {
        setSessionProgress({
          current: data.processedPages || data.processedFiles,
          total: data.totalPages || data.totalFiles,
          status: data.status
        });
        
        // Only update credits if they actually decreased (not just different from current state)
        if (data.userCredits !== undefined) {
          const currentCredits = lastKnownCredits !== null ? lastKnownCredits : user?.credits || 0;
          if (data.userCredits < currentCredits) {
            console.log(`[Credits] Decreased from ${currentCredits} to ${data.userCredits}`);
            updateCredits(data.userCredits);
            setLastKnownCredits(data.userCredits);
          } else if (data.userCredits === currentCredits) {
            // Credits haven't changed, do nothing
          } else {
            console.log(`[Credits] Unexpected increase or same value: ${currentCredits} -> ${data.userCredits}`);
          }
        }
        
        // Update currentSession with server data to keep it in sync
        if (currentSession && (data.status === 'PROCESSING' || data.status === 'UPLOADING')) {
          setCurrentSession(prev => ({
            ...prev,
            status: data.status,
            processedPages: data.processedPages || data.processedFiles,
            totalPages: data.totalPages || data.totalFiles,
          }));
        }
        
        // If session is complete, check post-processing status
        if (data.status === 'COMPLETED') {
          checkPostProcessingStatus(sessionId);
        } else if (data.status === 'FAILED') {
          // For failed sessions, clear immediately
          localStorage.removeItem('activeSession');
          setCurrentSession(null);
          setSessionProgress({ current: 0, total: 0, status: 'idle' });
          setPostProcessingStatus(null);
          fetchAllUserSessions();
        }
      }
    } catch (error) {
      console.error('Error checking session status:', error);
    }
  };

  // Check post-processing status
  const checkPostProcessingStatus = async (sessionId) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/sessions/${sessionId}/post-processing-status`);
      const data = await response.json();
      
      if (response.ok) {
        setPostProcessingStatus(data.status);
        
        // If post-processing is complete, clear the session after showing completion
        if (data.status === 'COMPLETED') {
          localStorage.removeItem('activeSession');
          setTimeout(() => {
            setCurrentSession(null);
            setSessionProgress({ current: 0, total: 0, status: 'idle' });
            setPostProcessingStatus(null);
            fetchAllUserSessions();
          }, 3000); // Show completion message for 3 seconds
        }
      }
    } catch (error) {
      console.error('Error checking post-processing status:', error);
    }
  };

  // Poll session status when there's an active session
  useEffect(() => {
    if (currentSession && (sessionProgress.status === 'processing' || sessionProgress.status === 'PROCESSING' || sessionProgress.status === 'UPLOADING')) {
      const interval = setInterval(() => {
        checkSessionStatus(currentSession.serverId || currentSession.id);
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [currentSession, sessionProgress.status]);

  // Poll post-processing status when Azure processing is complete
  useEffect(() => {
    if (currentSession && sessionProgress.status === 'COMPLETED' && postProcessingStatus !== 'COMPLETED') {
      const interval = setInterval(() => {
        checkPostProcessingStatus(currentSession.serverId || currentSession.id);
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [currentSession, sessionProgress.status, postProcessingStatus]);

  // Fetch model information when model changes
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/models/${selectedModel}/info`);
        const data = await response.json();
        
        if (response.ok) {
          setModelFields(data.fields);
          console.log('Model fields loaded:', Object.keys(data.fields || {}));
        } else {
          console.error('Model not found:', data.error);
          setModelFields(null);
        }
      } catch (error) {
        console.error('Error fetching model info:', error);
        setModelFields(null);
      }
    };
    
    if (selectedModel) {
      fetchModelInfo();
    }
  }, [selectedModel]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Don't allow new uploads if session is in progress
    if (currentSession && sessionProgress.status === 'processing') {
      alert('Please wait for the current session to complete before uploading new files.');
      return;
    }
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      setPendingFiles(droppedFiles);
      countPages(droppedFiles);
      setShowConfirmModal(true);
    }
  };

  const handleFileSelect = (e) => {
    // Don't allow new uploads if session is in progress
    if (currentSession && sessionProgress.status === 'processing') {
      alert('Please wait for the current session to complete before uploading new files.');
      e.target.value = '';
      return;
    }
    
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    );
    
    if (selectedFiles.length > 0) {
      setPendingFiles(selectedFiles);
      countPages(selectedFiles);
      setShowConfirmModal(true);
    } else {
      // Clear the input if no valid files were selected
      e.target.value = '';
    }
  };

  const countPages = async (filesToCount) => {
    const counts = {};
    for (const file of filesToCount) {
      const pageCount = await countPDFPages(file);
      counts[file.name] = pageCount;
    }
    setFilePageCounts(counts);
  };

  const getTotalPages = () => {
    return Object.values(filePageCounts).reduce((sum, count) => sum + count, 0);
  };

  const handleConfirmUpload = () => {
    setFiles(pendingFiles);
    createSessionAndUpload(pendingFiles);
    setShowConfirmModal(false);
    // Clear the file input after confirmation
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleCancelUpload = () => {
    setPendingFiles([]);
    setFilePageCounts({});
    setShowConfirmModal(false);
    // Clear the file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({current: 0, total: 0});
  const [lastResult, setLastResult] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [recentJobs, setRecentJobs] = useState([]);
  const [showRenameBuilder, setShowRenameBuilder] = useState(false);
  const [renameData, setRenameData] = useState(null);

  // Create session and upload multiple files
  const createSessionAndUpload = async (filesToUpload) => {
    setIsUploading(true);
    
    // Use total pages from filePageCounts
    const totalPagesCount = Object.values(filePageCounts).reduce((sum, count) => sum + count, 0);
    setSessionProgress({ current: 0, total: totalPagesCount, status: 'UPLOADING' });
    
    // Create a new session
    const sessionId = Date.now().toString();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const session = {
      id: sessionId,
      clientId: sessionId, // Keep track of client-side ID
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'UPLOADING',
      totalFiles: filesToUpload.length,
      totalPages: totalPagesCount,
      processedPages: 0,
      processedFiles: 0,
      files: filesToUpload.map(f => ({ name: f.name, status: 'pending' })),
      jobs: []
    };
    
    setCurrentSession(session);
    localStorage.setItem('activeSession', JSON.stringify(session));
    
    // Prepare FormData with all files
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('modelId', selectedModel);
    
    // Add all files to FormData
    filesToUpload.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetchWithAuth(`${API_URL}/api/jobs/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Session created successfully:', result);
        
        // Update session with server response - use server ID as the main ID
        const updatedSession = {
          ...session,
          id: result.sessionId, // Use server ID as the main ID
          clientId: session.id, // Keep original client ID for reference
          serverId: result.sessionId,
          status: result.status,
          totalPages: result.totalPages || totalPagesCount // Use server's totalPages
        };
        setCurrentSession(updatedSession);
        localStorage.setItem('activeSession', JSON.stringify(updatedSession));
        
        // Start polling for status
        checkSessionStatus(result.sessionId);
        
        // Refresh session list
        fetchAllUserSessions();
      } else {
        alert(`❌ Error creating session: ${result.error}\n\n${result.details || ''}`);
        localStorage.removeItem('activeSession');
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Failed to upload files. Make sure the backend is running on port 3003.`);
      localStorage.removeItem('activeSession');
      setCurrentSession(null);
    } finally {
      setIsUploading(false);
      setFiles([]);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  // Speed up session expiration (development only)
  const speedUpExpiration = async (sessionId) => {
    if (import.meta.env.MODE === 'production') return;
    
    setSpeedingUpSessions(prev => new Set(prev).add(sessionId));
    
    try {
      const response = await fetchWithAuth(`${API_URL}/api/dev/speed-up-expiration/${sessionId}`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Session expiration accelerated!\nNew expiry: ${new Date(result.newExpiresAt).toLocaleString()}`);
        // Refresh sessions to show updated expiration
        fetchAllUserSessions();
      } else {
        alert(`Failed to speed up expiration: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error speeding up expiration:', error);
      alert('Failed to speed up session expiration');
    } finally {
      setSpeedingUpSessions(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  // Download session results
  const downloadSessionResults = async (sessionId) => {
    setIsDownloading(true);
    setDownloadingSessions(prev => new Set(prev).add(sessionId));
    
    try {
      const response = await fetchWithAuth(`${API_URL}/api/jobs/session/${sessionId}/download`);
      
      if (response.status === 410) {
        // Session expired
        const errorData = await response.json();
        alert(errorData.message || 'This session has expired. Files are no longer available for download.');
        
        // Refresh sessions to update the UI
        fetchAllUserSessions();
        return;
      }
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${sessionId}_results.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Clear session after download if it's the current session
        if (currentSession && currentSession.id === sessionId) {
          localStorage.removeItem('activeSession');
          setCurrentSession(null);
          setSessionProgress({ current: 0, total: 0, status: 'idle' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to download session results');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download session results. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadingSessions(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const finishProcessing = (result, customFileName) => {
    // Add to recent jobs
    const newJob = {
      id: result.jobId,
      sessionId: result.sessionId,
      originalFileName: result.originalFileName,
      renamedFileName: customFileName || result.renamedFileName,
      status: 'completed',
      date: new Date().toISOString(),
      pages: result.pageCount,
      confidence: result.confidence,
      downloadUrl: result.downloadUrl,
      extractedData: result.extractedData,
      availableFields: result.availableFields
    };
    
    setRecentJobs(prev => [newJob, ...prev].slice(0, 10)); // Keep last 10 jobs
    
    // Show success message
    const fields = result.extractedData;
    let extractedInfo = `✅ Document processed successfully!\n\n`;
    extractedInfo += `📄 Original: ${result.originalFileName}\n`;
    extractedInfo += `📝 Renamed: ${customFileName || result.renamedFileName}\n`;
    extractedInfo += `📄 Model Used: ${result.modelUsed}\n`;
    extractedInfo += `📑 Pages Processed: ${result.pageCount}\n`;
    extractedInfo += `🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    extractedInfo += `💳 Credits Remaining: ${result.creditsRemaining}\n\n`;
    extractedInfo += `📋 Extracted Data:\n`;
    
    // Display key fields if they exist
    if (!Array.isArray(fields)) {
      Object.entries(fields).forEach(([key, value]) => {
        if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
          extractedInfo += `${key}: ${value.value}\n`;
        }
      });
    }
    
    extractedInfo += `\n📥 Download package ready with renamed PDF and Excel!`;
    
    alert(extractedInfo);
    
    // Increment processed count
    setProcessedCount(prev => prev + 1);
  };

  const handleRename = (newFileName) => {
    setShowRenameBuilder(false);
    if (renameData && renameData.result) {
      finishProcessing(renameData.result, newFileName);
    }
    setRenameData(null);
  };

  const exportToExcel = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/jobs/export/excel`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`❌ ${error.error || 'Failed to export Excel file'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export Excel file');
    }
  };

  // if (showModelTraining) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
  //       <header className="relative bg-white/70 backdrop-blur-md shadow-sm border-b border-gray-100">
  //         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  //           <div className="flex justify-between items-center h-16">
  //             <div className="flex items-center gap-3">
  //               <Button
  //                 variant="ghost"
  //                 onClick={() => setShowModelTraining(false)}
  //                 className="mr-2"
  //               >
  //                 ← Back to Dashboard
  //               </Button>
  //             </div>
  //           </div>
  //         </div>
  //       </header>
  //       <ModelTrainingPage />
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 overflow-x-hidden">
      {/* File Rename Builder Modal */}
      {showRenameBuilder && renameData && (
        <FileRenameBuilder
          availableFields={renameData.availableFields}
          originalFileName={renameData.originalFileName}
          sessionId={renameData.sessionId}
          onRename={handleRename}
          onClose={() => {
            setShowRenameBuilder(false);
            // If closed without renaming, still finish processing with original name
            if (renameData.result) {
              finishProcessing(renameData.result);
            }
            setRenameData(null);
          }}
        />
      )}

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-amber-500" />
              Confirm Document Processing
            </DialogTitle>
            <DialogDescription>
              Please review the documents you're about to process:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Files List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Documents to Process:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="truncate flex-1 pr-2 text-gray-900 dark:text-gray-100">{file.name}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {filePageCounts[file.name] || 1} page{filePageCounts[file.name] !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Documents:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{pendingFiles.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Pages:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{getTotalPages()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Credits to Use:</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">{getTotalPages()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Model:</span>
                <span className="font-medium text-xs text-gray-900 dark:text-gray-100">SILVI READER 2.0</span>
              </div>
            </div>

            {/* Fields that will be extracted */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Fields to Extract:</h4>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                {modelFields === null ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading model fields...
                  </div>
                ) : Object.keys(modelFields).length === 0 ? (
                  <div className="text-xs text-amber-600 dark:text-amber-400 text-center py-4">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500 dark:text-amber-400" />
                    <p className="font-medium mb-1">Model Information Not Available</p>
                    <p className="text-gray-600 dark:text-gray-400">Unable to retrieve field information for this model.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    {Object.entries(modelFields)
                      .map(([field, info]) => (
                        <div key={field} className="flex items-start gap-1">
                          <span className="text-gray-400 dark:text-gray-500">•</span>
                          <span>{info.description || field.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Warning if low credits */}
            {user?.credits < getTotalPages() && (
              <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
                  You don't have enough credits. You need {getTotalPages()} credits but only have {user?.credits}.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelUpload}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmUpload}
              disabled={user?.credits < getTotalPages()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Process {getTotalPages()} Page{getTotalPages() !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 dark:bg-yellow-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="w-full px-4 tablet:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 tablet:h-16">
            <div className="flex items-center gap-2 tablet:gap-3 min-w-0 flex-1">
              <div className="p-1.5 tablet:p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0">
                <FileCheck className="h-5 w-5 tablet:h-6 tablet:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base tablet:text-lg desktop:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
                  Dump Truck Invoice Reader
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden tablet:block">Automated Document Processing</p>
              </div>
            </div>
            <div className="flex items-center gap-2 tablet:gap-3 desktop:gap-4 flex-shrink-0">
              <div className="flex items-center gap-1 tablet:gap-2 px-3 tablet:px-4 py-1.5 tablet:py-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-full border border-emerald-200 dark:border-emerald-800 transition-all duration-300">
                <Zap className="h-3.5 w-3.5 tablet:h-4 tablet:w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs tablet:text-sm font-semibold text-emerald-700 dark:text-emerald-300">{user?.credits || 0}</span>
                <span className="hidden tablet:inline text-xs tablet:text-sm font-semibold text-emerald-700 dark:text-emerald-300">Credits</span>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 tablet:h-9 tablet:w-9 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" 
                onClick={logout}
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 overflow-x-hidden">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Success Rate"
            value="98.5%"
            trend="+2.3%"
            color="emerald"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            title="Avg. Process Time"
            value="12s"
            trend="-3s"
            color="blue"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            title="Documents Today"
            value="24"
            trend="+12"
            color="purple"
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Accuracy Score"
            value="99.2%"
            trend="+0.5%"
            color="pink"
          />
        </div>

        {/* Ongoing Training Section */}
        {/* <OngoingTraining /> */}

        <div className="grid grid-cols-1 tablet:grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {/* Upload Section */}
          <div className="tablet:col-span-1 lg:col-span-2 xl:col-span-3 space-y-4 sm:space-y-6">
            <Card className="overflow-hidden border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-20">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <Sparkles className="h-6 w-6" />
                      Smart Invoice Processing
                    </CardTitle>
                    <CardDescription className="text-indigo-100 dark:text-indigo-200 mt-2">
                      Upload your invoices for instant automated data extraction
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="-mt-10">
                <div
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-dashed transition-all duration-300 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105 shadow-2xl' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xl'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="p-12 text-center">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDragging 
                        ? 'bg-indigo-100 scale-110' 
                        : 'bg-gradient-to-br from-indigo-50 to-purple-50'
                    }`}>
                      <Upload className={`h-10 w-10 transition-all duration-300 ${
                        isDragging ? 'text-indigo-600 scale-110' : 'text-indigo-500'
                      }`} />
                    </div>
                    <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                      Drop your invoices here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      or click to browse multiple files from your computer
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Button 
                      variant="default" 
                      size="lg" 
                      className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isUploading || (currentSession && sessionProgress.status === 'processing')}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Creating Session...
                        </>
                      ) : currentSession && sessionProgress.status === 'processing' ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Session in Progress
                        </>
                      ) : (
                        'Select Invoices'
                      )}
                    </Button>
                    {files.length > 0 && (
                      <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in slide-in-from-bottom duration-300">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {files.length} file{files.length > 1 ? 's' : ''} ready to process
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {files.map((f, idx) => (
                            <p key={idx} className="text-xs text-emerald-600 dark:text-emerald-400">
                              • {f.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Model Selection
                    </label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Silvi_Reader_Full_2.0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Custom</Badge>
                            <span>SILVI READER 2.0</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>


                {/* Session Expiry Warning */}
                {currentSession && (() => {
                  const sessionDate = new Date(currentSession.createdAt);
                  const now = new Date();
                  const hoursElapsed = (now - sessionDate) / (1000 * 60 * 60);
                  const hoursRemaining = 24 - hoursElapsed;
                  
                  if (hoursRemaining < 2 && hoursRemaining > 0) {
                    return (
                      <Alert className="mt-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription className="text-red-700 dark:text-red-300">
                          <strong>Session Expiring Soon:</strong> This session will expire in {Math.floor(hoursRemaining * 60)} minutes. 
                          Please download your results before they are removed.
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}

              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2 text-gray-900 dark:text-white">
                    <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Recent Processing Sessions
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Refresh button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHasSessionsCheck(null);
                        checkHasSessions().then(hasSessions => {
                          if (hasSessions) {
                            fetchAllUserSessions();
                          }
                        });
                      }}
                      disabled={sessionsLoading}
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                      <RefreshCw className={`h-4 w-4 ${sessionsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    {/* Development only - Clear sessions button */}
                    {import.meta.env.MODE !== 'production' && userSessions.length > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete ALL your sessions? This cannot be undone!')) {
                          try {
                            const response = await fetchWithAuth(`${API_URL}/api/dev/clear-sessions`, {
                              method: 'DELETE'
                            });
                            
                            if (response.ok) {
                              const result = await response.json();
                              alert(`Successfully deleted ${result.deletedCount} sessions`);
                              setCurrentPage(1);
                              setSessionFilter('all');
                              fetchAllUserSessions();
                            } else {
                              alert('Failed to clear sessions');
                            }
                          } catch (error) {
                            console.error('Error clearing sessions:', error);
                            alert('Error clearing sessions');
                          }
                        }
                      }}
                      className="text-xs"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Clear All Sessions
                    </Button>
                    )}
                  </div>
                </div>
                {/* Status Filters */}
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
                  <Button
                    size="sm"
                    variant={sessionFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => {
                      setSessionFilter('all');
                      setCurrentPage(1);
                    }}
                    className="text-xs px-4"
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={sessionFilter === 'completed' ? 'default' : 'outline'}
                    onClick={() => {
                      setSessionFilter('completed');
                      setCurrentPage(1);
                    }}
                    className="text-xs px-4"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Button>
                  <Button
                    size="sm"
                    variant={sessionFilter === 'processing' ? 'default' : 'outline'}
                    onClick={() => {
                      setSessionFilter('processing');
                      setCurrentPage(1);
                    }}
                    className="text-xs px-4"
                  >
                    <Loader2 className="h-3 w-3 mr-1" />
                    Processing
                  </Button>
                  <Button
                    size="sm"
                    variant={sessionFilter === 'failed' ? 'default' : 'outline'}
                    onClick={() => {
                      setSessionFilter('failed');
                      setCurrentPage(1);
                    }}
                    className="text-xs px-4"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sessionsLoading && hasSessionsCheck ? (
                  // Show loading state only if we know user has sessions
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500 animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading your sessions...</p>
                  </div>
                ) : userSessions.length === 0 && recentJobs.length === 0 && !currentSession ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No documents processed yet</p>
                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">Upload your first invoice to get started</p>
                  </div>
                ) : (
                  <>
                    {/* Sessions Table - Desktop and Tablet */}
                    <div className="hidden sm:block rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                      <table className="w-full min-w-[800px] divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Session ID
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                                Created
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                                Expires
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Pages
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px] md:min-w-[140px] hidden md:table-cell">
                                Progress
                              </th>
                              <th className="px-3 md:px-4 lg:px-6 py-2 tablet:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                                Actions
                              </th>
                            </tr>
                          </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {userSessions
                                .map((session) => {
                                  const progress = session.totalPages > 0 
                                    ? Math.round((session.processedPages / session.totalPages) * 100)
                                    : 0;
                                  const expired = isSessionExpired(session.expiresAt);
                                  const expiringSoon = isExpiringSoon(session.expiresAt);
                                  const timeRemaining = formatTimeRemaining(session.expiresAt);
                                  
                                  const statusColor = expired 
                                    ? 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
                                    : {
                                      'COMPLETED': 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
                                      'FAILED': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
                                      'PROCESSING': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
                                      'ACTIVE': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
                                      'UPLOADING': 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20',
                                      'CANCELLED': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20',
                                      'EXPIRED': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
                                    }[session.status] || 'text-gray-600 bg-gray-100';
                                  
                                  // Row highlighting for expiring sessions
                                  const rowClass = expired 
                                    ? "opacity-50 bg-gray-50 dark:bg-gray-900/30"
                                    : expiringSoon 
                                    ? "bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50";
                                  
                                  return (
                                    <tr key={session.id} className={rowClass}>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4 text-xs tablet:text-sm font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                        {session.id.slice(0, 6)}...
                                      </td>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4 text-xs tablet:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                        {formatTimeAgo(session.createdAt)}
                                      </td>
                                      <td className={`px-3 md:px-4 lg:px-6 py-3 tablet:py-4 text-xs tablet:text-sm hidden lg:table-cell ${expired ? 'text-red-500 dark:text-red-400 font-medium' : expiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                        <div className="flex items-center gap-1">
                                          {expiringSoon && !expired && (
                                            <AlertCircle className="h-3 w-3 text-amber-500" />
                                          )}
                                          {timeRemaining}
                                        </div>
                                      </td>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4 text-xs tablet:text-sm text-center text-gray-900 dark:text-gray-100">
                                        {session.totalPages || session.totalFiles}
                                      </td>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4">
                                        <div className="space-y-1">
                                          <span className={`inline-flex items-center gap-1 px-1.5 tablet:px-2 py-0.5 tablet:py-1 text-xs font-semibold rounded-full ${
                                            downloadingSessions.has(session.id) 
                                              ? 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20' 
                                              : statusColor
                                          }`}>
                                            {downloadingSessions.has(session.id) ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                DOWNLOADING...
                                              </>
                                            ) : (
                                              <>
                                                {session.status === 'PROCESSING' && (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                )}
                                                {expired ? 'EXPIRED' : session.status}
                                              </>
                                            )}
                                          </span>
                                          {/* Show progress bar under status on tablets */}
                                          {session.status === 'PROCESSING' && (
                                            <div className="flex items-center lg:hidden">
                                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mr-1">
                                                <div 
                                                  className="bg-indigo-600 h-1.5 rounded-full" 
                                                  style={{ width: `${progress}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {progress}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4 hidden md:table-cell">
                                        <div className="flex items-center">
                                          <div className="w-24 md:w-32 lg:w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                            <div 
                                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                              style={{ width: `${progress}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            {progress}%
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-3 md:px-4 lg:px-6 py-3 tablet:py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                          {session.status === 'COMPLETED' && (
                                            <Button
                                              size="icon"
                                              variant={expired ? "ghost" : "outline"}
                                              disabled={expired || downloadingSessions.has(session.id)}
                                              className={`h-8 w-8 md:h-9 md:w-auto md:px-3 ${
                                                expired 
                                                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50' 
                                                  : downloadingSessions.has(session.id) 
                                                  ? "opacity-70 cursor-wait"
                                                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                              }`}
                                              title={expired ? "Session expired - files no longer available" : downloadingSessions.has(session.id) ? "Downloading..." : expiringSoon ? "Session expiring soon" : "Download all files"}
                                              onClick={() => {
                                                if (expired) {
                                                  alert('This session has expired. Files are no longer available for download.');
                                                } else if (!downloadingSessions.has(session.id)) {
                                                  downloadSessionResults(session.id);
                                                }
                                              }}
                                            >
                                              {downloadingSessions.has(session.id) ? (
                                                <Loader2 className="h-3 w-3 animate-spin md:mr-1" />
                                              ) : (
                                                <Download className="h-3 w-3 md:mr-1" />
                                              )}
                                              <span className="hidden md:inline">{expired ? 'Expired' : downloadingSessions.has(session.id) ? 'Downloading...' : 'Download'}</span>
                                            </Button>
                                          )}
                                          {import.meta.env.MODE !== 'production' && !expired && session.status === 'COMPLETED' && (session.postProcessingStatus !== 'COMPLETED' || !session.postProcessingStatus) && (
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={async () => {
                                                try {
                                                  const response = await fetchWithAuth(`${API_URL}/api/dev/reprocess-session/${session.id}`, {
                                                    method: 'POST'
                                                  });
                                                  const result = await response.json();
                                                  if (result.success) {
                                                    alert('Reprocessing started! Please wait a moment and refresh.');
                                                    fetchAllUserSessions();
                                                  } else {
                                                    alert(`Error: ${result.error}`);
                                                  }
                                                } catch (error) {
                                                  alert('Failed to reprocess session');
                                                }
                                              }}
                                              className="flex items-center gap-1 px-2 py-1 text-xs"
                                              title="Reprocess files (Dev only)"
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                              <span className="hidden lg:inline">Reprocess</span>
                                            </Button>
                                          )}
                                          {import.meta.env.MODE !== 'production' && !expired && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => speedUpExpiration(session.id)}
                                              disabled={speedingUpSessions.has(session.id)}
                                              className="flex items-center gap-1 px-2 py-1 text-xs border-amber-300 dark:border-amber-700 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                              title="Speed up expiration to 1 minute (Dev only)"
                                            >
                                              {speedingUpSessions.has(session.id) ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <FastForward className="h-3 w-3" />
                                              )}
                                              <span className="hidden lg:inline">Speed</span>
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                    </div>
                    
                    {/* Sessions Cards - Mobile and Small Tablets */}
                    <div className="sm:hidden space-y-3">
                      {userSessions
                        .map((session) => {
                          const progress = session.totalPages > 0 
                            ? Math.round((session.processedPages / session.totalPages) * 100)
                            : 0;
                          const expired = isSessionExpired(session.expiresAt);
                          const expiringSoon = isExpiringSoon(session.expiresAt);
                          const timeRemaining = formatTimeRemaining(session.expiresAt);
                          
                          const cardClass = expired 
                            ? "bg-gray-50 dark:bg-gray-900/30 opacity-50"
                            : expiringSoon 
                            ? "bg-amber-50 dark:bg-amber-900/10 border-l-4 border-l-amber-500"
                            : "bg-white dark:bg-gray-800";
                          
                          return (
                            <div key={session.id} className={`${cardClass} rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Session ID</p>
                                  <p className="font-mono text-sm text-gray-900 dark:text-gray-100">{session.id.slice(0, 8)}...</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                  downloadingSessions.has(session.id)
                                    ? 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20'
                                    : expired 
                                    ? 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
                                    : {
                                      'COMPLETED': 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
                                      'FAILED': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
                                      'PROCESSING': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
                                      'ACTIVE': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
                                      'UPLOADING': 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20',
                                      'CANCELLED': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20',
                                      'EXPIRED': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
                                    }[session.status] || 'text-gray-600 bg-gray-100'
                                }`}>
                                  {downloadingSessions.has(session.id) ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      DOWNLOADING...
                                    </>
                                  ) : (
                                    <>
                                      {session.status === 'PROCESSING' && (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      )}
                                      {expired ? 'EXPIRED' : session.status}
                                    </>
                                  )}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                                  <p className="text-gray-900 dark:text-gray-100">{formatTimeAgo(session.createdAt)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Expires</p>
                                  <p className={expired ? 'text-red-500 dark:text-red-400 font-medium' : expiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-900 dark:text-gray-100'}>
                                    <span className="flex items-center gap-1">
                                      {expiringSoon && !expired && (
                                        <AlertCircle className="h-3 w-3 text-amber-500" />
                                      )}
                                      {timeRemaining}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {session.totalPages || session.totalFiles} page{(session.totalPages || session.totalFiles) !== 1 ? 's' : ''}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                              
                              {session.status === 'COMPLETED' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={expired ? "outline" : "default"}
                                    disabled={expired || downloadingSessions.has(session.id) || (session.status === 'COMPLETED' && session.postProcessingStatus !== 'COMPLETED')}
                                    className={`w-full ${expired ? "opacity-50 cursor-not-allowed" : downloadingSessions.has(session.id) ? "opacity-70 cursor-wait" : ""}`}
                                    onClick={() => {
                                      if (expired) {
                                        alert('This session has expired. Files are no longer available for download.');
                                      } else if (session.postProcessingStatus !== 'COMPLETED') {
                                        alert('Files are still being prepared. Please wait...');
                                      } else if (!downloadingSessions.has(session.id)) {
                                        downloadSessionResults(session.id);
                                      }
                                    }}
                                  >
                                    {downloadingSessions.has(session.id) ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4 mr-2" />
                                    )}
                                    {expired ? 'Expired' : downloadingSessions.has(session.id) ? 'Downloading...' : session.postProcessingStatus !== 'COMPLETED' ? 'Preparing...' : 'Download Results'}
                                  </Button>
                                  {import.meta.env.MODE !== 'production' && !expired && (session.postProcessingStatus !== 'COMPLETED' || !session.postProcessingStatus) && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={async () => {
                                        try {
                                          const response = await fetchWithAuth(`${API_URL}/api/dev/reprocess-session/${session.id}`, {
                                            method: 'POST'
                                          });
                                          const result = await response.json();
                                          if (result.success) {
                                            alert('Reprocessing started! Please wait a moment and refresh.');
                                            fetchAllUserSessions();
                                          } else {
                                            alert(`Error: ${result.error}`);
                                          }
                                        } catch (error) {
                                          alert('Failed to reprocess session');
                                        }
                                      }}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Reprocess
                                    </Button>
                                  )}
                                  {import.meta.env.MODE !== 'production' && !expired && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => speedUpExpiration(session.id)}
                                      disabled={speedingUpSessions.has(session.id)}
                                      className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                      title="Speed up expiration (Dev only)"
                                    >
                                      {speedingUpSessions.has(session.id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FastForward className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* Pagination */}
                    {totalSessions > sessionsPerPage && (
                      <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3">
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
                          Showing {((currentPage - 1) * sessionsPerPage) + 1} to {Math.min(currentPage * sessionsPerPage, totalSessions)} of {totalSessions}
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.ceil(totalSessions / sessionsPerPage) }, (_, i) => i + 1)
                              .filter(page => {
                                const totalPages = Math.ceil(totalSessions / sessionsPerPage);
                                if (totalPages <= 5) return true;
                                if (page === 1 || page === totalPages) return true;
                                if (Math.abs(page - currentPage) <= 1) return true;
                                return false;
                              })
                              .map((page, index, arr) => (
                                <React.Fragment key={page}>
                                  {index > 0 && arr[index - 1] < page - 1 && (
                                    <span className="px-2 text-gray-400">...</span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={currentPage === page ? 'default' : 'outline'}
                                    onClick={() => setCurrentPage(page)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {page}
                                  </Button>
                                </React.Fragment>
                              ))}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalSessions / sessionsPerPage), p + 1))}
                            disabled={currentPage === Math.ceil(totalSessions / sessionsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Show recent jobs if any */}
                    {recentJobs.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Legacy Jobs</h4>
                        <div className="space-y-2">
                          {recentJobs.map((job) => (
                            <JobItemWithDownload
                              key={job.id}
                              job={job}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 tablet:space-y-5 desktop:space-y-6">
            {/* Session Progress */}
            {currentSession && (sessionProgress.status === 'processing' || (sessionProgress.status === 'COMPLETED' && postProcessingStatus !== 'COMPLETED')) ? (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {sessionProgress.status === 'COMPLETED' ? 'Preparing Files' : 'Processing Session'}
                  </CardTitle>
                  <CardDescription className="text-indigo-100">
                    Session ID: {currentSession.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-medium">
                          {sessionProgress.current} / {sessionProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={
                          sessionProgress.status === 'COMPLETED' 
                            ? 80 + (postProcessingStatus === 'PROCESSING' ? 10 : 0) + (postProcessingStatus === 'COMPLETED' ? 20 : 0)
                            : (sessionProgress.current / sessionProgress.total) * 80
                        } 
                        className="h-3 bg-indigo-200"
                      />
                    </div>
                    <p className="text-indigo-100 text-sm">
                      {sessionProgress.status === 'COMPLETED' 
                        ? 'Renaming files based on extracted data...'
                        : `Processing file ${sessionProgress.current} of ${sessionProgress.total}...`
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : currentSession && sessionProgress.status === 'completed' && postProcessingStatus === 'COMPLETED' ? (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Session Complete
                  </CardTitle>
                  <CardDescription className="text-emerald-100">
                    All files processed successfully
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold">
                      {sessionProgress.total} files
                    </div>
                    <p className="text-emerald-100 text-sm">
                      Ready for download
                    </p>
                    <Button 
                      className="w-full bg-white text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-70 disabled:cursor-wait"
                      onClick={() => downloadSessionResults(currentSession.serverId || currentSession.id)}
                      disabled={postProcessingStatus !== 'COMPLETED' || isDownloading}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download Results
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Credit Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl tablet:text-4xl desktop:text-5xl font-bold mb-2">
                    {user?.credits || 0}
                  </div>
                  <p className="text-sm tablet:text-base text-emerald-100 mb-4 tablet:mb-5 desktop:mb-6">
                    Process up to {user?.credits || 0} more pages
                  </p>
                  {/* Development Tier Info */}
                  {import.meta.env.MODE === 'development' && tierInfo && (
                    <div className="mb-4 p-3 bg-emerald-600/30 rounded-lg border border-emerald-400/30">
                      <div className="text-xs text-emerald-100 space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3" />
                          <span>Azure Tier: <span className="font-semibold">{tierInfo.tier}</span></span>
                        </div>
                        <div className="text-emerald-100/80">
                          {tierInfo.tier === 'STANDARD' ? (
                            <span>Processing up to {tierInfo.maxConcurrent} pages concurrently</span>
                          ) : (
                            <span>Processing 1 page at a time (sequential)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <Button className="w-full bg-white text-emerald-700 hover:bg-emerald-50 font-semibold">
                    Upgrade to Pro
                  </Button>
                  <div className="mt-4 pt-4 border-t border-emerald-400">
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-100">Next renewal</span>
                      <span className="font-medium">Feb 1, 2025</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Model Info */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Model Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Model Version</span>
                      <span className="font-medium">v2.4.1</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Confidence Score</span>
                      <span className="font-medium text-emerald-600">98.5%</span>
                    </div>
                    <Progress value={98.5} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Fields Extracted</span>
                      <span className="font-medium">15/15</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

function StatCard({ icon, title, value, trend, color }) {
  const bgColorClasses = {
    emerald: 'bg-emerald-50',
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    pink: 'bg-pink-50',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    pink: 'text-pink-600',
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      <CardContent className="p-3 xs:p-4 tablet:p-5 desktop:p-6">
        <div className="flex items-center justify-between mb-2 xs:mb-3 tablet:mb-4">
          <div className={`p-1.5 xs:p-2 tablet:p-2.5 desktop:p-3 rounded-lg ${bgColorClasses[color]}`}>
            <div className={iconColorClasses[color]}>
              {icon}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {trend}
          </Badge>
        </div>
        <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-lg xs:text-xl tablet:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function JobItem({ fileName, status, date, pages, progress, error, amount }) {
  const statusConfig = {
    queued: { 
      label: 'Queued', 
      icon: <Clock className="h-4 w-4" />,
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
    },
    processing: { 
      label: 'Processing', 
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    completed: { 
      label: 'Completed', 
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    failed: { 
      label: 'Failed', 
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600 bg-red-50 border-red-200'
    },
  };

  const config = statusConfig[status];

  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-300 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors">
          <FileText className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{fileName}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">{date}</p>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">{pages} page{pages > 1 ? 's' : ''}</p>
            {amount && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <p className="text-xs font-medium text-emerald-600">{amount}</p>
              </>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status === 'processing' && progress && (
          <div className="w-32">
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{progress}%</span>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.color}`}>
          {config.icon}
          {config.label}
        </div>
        {status === 'completed' && (
          <Button size="sm" variant="ghost" className="ml-2 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function JobItemWithDownload({ job }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { token } = useAuth();
  
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}${job.downloadUrl}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_package_${job.sessionId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download package');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download package');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Format the date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };
  
  // Extract amount from data if available
  let amount = null;
  if (job.extractedData && !Array.isArray(job.extractedData)) {
    const amountFields = ['InvoiceTotal', 'TotalAmount', 'Total', 'AmountDue', 'Amount'];
    for (const field of amountFields) {
      if (job.extractedData[field]?.value) {
        amount = job.extractedData[field].value;
        break;
      }
    }
  }
  
  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-300 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors">
          <FileText className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{job.originalFileName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">→ {job.renamedFileName}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500">{formatDate(job.date)}</p>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs text-gray-500">{job.pages} page{job.pages > 1 ? 's' : ''}</p>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs text-gray-500">{(job.confidence * 100).toFixed(0)}% confidence</p>
            {amount && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <p className="text-xs font-medium text-emerald-600">{amount}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border text-emerald-600 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleDownload}
          disabled={isDownloading}
          className="ml-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Download className="h-4 w-4 mr-1" />
              Download ZIP
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SessionItem({ session, progress, onDownload }) {
  const formatDate = (dateString) => {
    console.log(`[Frontend] SessionItem formatting date for session ${session.id}:`, dateString);
    
    if (!dateString) {
      console.warn(`[Frontend] No date string provided for session ${session.id}`);
      return 'Invalid Date';
    }
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      console.error(`[Frontend] Invalid date for session ${session.id}:`, dateString);
      return 'Invalid Date';
    }
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const statusConfig = {
    idle: { 
      label: 'Idle', 
      icon: <Clock className="h-4 w-4" />,
      color: 'text-gray-600 bg-gray-50 border-gray-200'
    },
    processing: { 
      label: 'Processing', 
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    completed: { 
      label: 'Completed', 
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    failed: { 
      label: 'Failed', 
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600 bg-red-50 border-red-200'
    },
  };

  const config = statusConfig[progress.status] || statusConfig.idle;

  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 rounded-lg">
          <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            Session {session.id}
            {console.log(`[Frontend] Rendering session ${session.id} with data:`, session)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Started {formatDate(session.createdAt)}</p>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">{progress.total} files</p>
            {progress.status === 'processing' && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">{progress.current} processed</p>
              </>
            )}
          </div>
          {progress.status === 'processing' && (
            <div className="mt-2 w-48">
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.color}`}>
          {config.icon}
          {config.label}
        </div>
        {progress.status === 'completed' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onDownload}
            className="ml-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
          >
            <Download className="h-4 w-4 mr-1" />
            Download All
          </Button>
        )}
      </div>
    </div>
  );
}

export default App;
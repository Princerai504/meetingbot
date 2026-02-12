// Popup Script - Controls the extension UI and handles recording
// Handles recording, upload, and display of results

// Enhanced recording state management
let recordingState = {
  isRecording: false,
  startTime: null,
  duration: 0,
  stream: null,
  mediaRecorder: null,
  audioChunks: [],
  currentAudioBlob: null,
  timer: null,
  errorCount: 0,
  maxErrorCount: 3
};

// DOM Elements
const elements = {
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  recordingSection: document.getElementById('recording-section'),
  recordingInfo: document.getElementById('recording-info'),
  recordingTimer: document.getElementById('recording-timer'),
  uploadSection: document.getElementById('upload-section'),
  uploadArea: document.getElementById('upload-area'),
  fileInput: document.getElementById('file-input'),
  processingSection: document.getElementById('processing-section'),
  resultsSection: document.getElementById('results-section'),
  summaryContent: document.getElementById('summary-content'),
  errorSection: document.getElementById('error-section'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  newRecordingBtn: document.getElementById('new-recording-btn'),
  downloadBtn: document.getElementById('download-btn'),
  viewHistoryBtn: document.getElementById('view-history-btn'),
  statusIndicator: document.getElementById('status-indicator'),
  statusText: document.getElementById('status-text'),
  backendStatusDot: document.getElementById('backend-status-dot'),
  backendStatusText: document.getElementById('backend-status-text')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Extension popup opened');
  
  // Check backend status
  await checkBackendStatus();
  
  // Check if user is on Google Meet
  await checkMeetStatus();
  
  // Setup event listeners
  setupEventListeners();
  
  // Listen for background messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'restartRecording') {
      console.log('[Popup] Received restart recording command');
      restartRecording();
      return true;
    }
  });
  
  // Initialize recording state
  initializeRecordingState();
});

// Initialize recording state
function initializeRecordingState() {
  recordingState = {
    isRecording: false,
    startTime: null,
    duration: 0,
    stream: null,
    mediaRecorder: null,
    audioChunks: [],
    currentAudioBlob: null,
    timer: null,
    errorCount: 0,
    maxErrorCount: 3
  };
}

// Check if backend is running
async function checkBackendStatus() {
  try {
    const response = await fetch('http://localhost:8000/meetings', {
      method: 'GET'
    });
    
    if (response.ok) {
      elements.backendStatusDot.className = 'status-dot online';
      elements.backendStatusText.textContent = 'Backend online';
    } else {
      throw new Error('Backend not responding');
    }
  } catch (error) {
    elements.backendStatusDot.className = 'status-dot offline';
    elements.backendStatusText.textContent = 'Backend offline';
    console.log('[Popup] Backend offline:', error.message);
  }
}

// Check if current tab is Google Meet
async function checkMeetStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && tab.url.includes('meet.google.com')) {
      // On Google Meet page
      elements.statusIndicator.className = 'status-badge online';
      elements.statusText.textContent = 'On Google Meet';
      elements.recordingSection.classList.remove('hidden');
    } else {
      // Not on Meet
      elements.statusIndicator.className = 'status-badge offline';
      elements.statusText.textContent = 'Not on Meet';
      elements.recordingSection.classList.add('hidden');
    }
  } catch (error) {
    console.error('[Popup] Error checking meet status:', error);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Recording buttons
  elements.startBtn.addEventListener('click', startRecording);
  elements.stopBtn.addEventListener('click', stopRecording);
  
  // File upload
  elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileUpload);
  
  // Drag and drop
  elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
  });
  
  elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.classList.remove('dragover');
  });
  
  elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  
  // Results actions
  elements.newRecordingBtn.addEventListener('click', resetUI);
  elements.downloadBtn.addEventListener('click', downloadAudio);
  elements.viewHistoryBtn.addEventListener('click', viewHistory);
  elements.retryBtn.addEventListener('click', resetUI);
}

// Start recording with enhanced state management
async function startRecording() {
  console.log('[Popup] Starting recording...');
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url.includes('meet.google.com')) {
      showError('Please navigate to a Google Meet meeting first');
      return;
    }
    
    // Check if already recording
    if (recordingState.isRecording) {
      showError('Already recording');
      return;
    }
    
    // Request recording permission from background script
    const recordingPermission = await requestRecordingPermission();
    if (!recordingPermission.granted) {
      showError('Recording permission denied: ' + recordingPermission.reason);
      return;
    }
    
    // Capture tab audio with proper error handling
    chrome.tabCapture.capture({
      audio: true,
      video: false
    }, (stream) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] tabCapture error:', chrome.runtime.lastError);
        showError('Failed to capture audio: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (!stream) {
        showError('Could not capture audio stream. Please make sure you are in an active Google Meet meeting.');
        return;
      }
      
      try {
        // Store stream for later cleanup
        recordingState.stream = stream;
        
        // Create MediaRecorder with proper error handling
        recordingState.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        recordingState.audioChunks = [];
        recordingState.errorCount = 0;
        
        // Enhanced data available handler with error recovery
        recordingState.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordingState.audioChunks.push(event.data);
            console.log('[Popup] Audio chunk received:', event.data.size, 'bytes');
          }
        };
        
        // Enhanced stop handler with proper cleanup
        recordingState.mediaRecorder.onstop = () => {
          console.log('[Popup] Recording stopped');
          // Stop all tracks to release the stream
          stream.getTracks().forEach(track => track.stop());
          recordingState.stream = null;
          
          // Notify background script
          chrome.runtime.sendMessage({
            action: 'recordingStopped',
            duration: recordingState.duration
          });
        };
        
        // Enhanced error handler with recovery
        recordingState.mediaRecorder.onerror = (event) => {
          console.error('[Popup] MediaRecorder error:', event);
          recordingState.isRecording = false;
          
          // Handle error with recovery
          handleRecordingError(event);
        };
        
        // Start recording with 1-second chunks
        recordingState.mediaRecorder.start(1000);
        recordingState.isRecording = true;
        recordingState.startTime = Date.now();
        recordingState.duration = 0;
        
        // Update recording state in background
        updateRecordingState(true);
        
        // Update UI
        elements.startBtn.classList.add('hidden');
        elements.stopBtn.classList.remove('hidden');
        elements.recordingInfo.classList.remove('hidden');
        elements.uploadSection.classList.add('hidden');
        
        // Start timer
        startTimer();
        
        console.log('[Popup] Recording started successfully');
      } catch (recorderError) {
        console.error('[Popup] MediaRecorder setup error:', recorderError);
        showError('Failed to initialize recorder: ' + recorderError.message);
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        recordingState.stream = null;
        
        // Notify background script
        chrome.runtime.sendMessage({
          action: 'recordingError',
          error: recorderError.message
        });
      }
    });
  } catch (error) {
    console.error('[Popup] Error starting recording:', error);
    showError('Error: ' + error.message);
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'recordingError',
      error: error.message
    });
  }
}

// Request recording permission from background script
async function requestRecordingPermission() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'requestRecordingPermission'
    }, (response) => {
      resolve(response);
    });
  });
}

// Update recording state in background
function updateRecordingState(isRecording) {
  chrome.runtime.sendMessage({
    action: 'updateRecordingState',
    isRecording: isRecording
  });
}

// Handle recording errors with recovery
function handleRecordingError(error) {
  console.error('[Popup] Handling recording error:', error);
  recordingState.errorCount++;
  
  if (recordingState.errorCount > recordingState.maxErrorCount) {
    console.error('[Popup] Maximum error count reached, stopping recording');
    showError('Recording failed after multiple attempts');
    cleanupRecordingResources();
    return;
  }
  
  // Attempt to restart recording
  if (recordingState.mediaRecorder && recordingState.mediaRecorder.state === 'inactive') {
    try {
      console.log('[Popup] Attempting to restart recording...');
      recordingState.mediaRecorder.start(1000);
      recordingState.isRecording = true;
      console.log('[Popup] Recording restarted successfully');
    } catch (restartError) {
      console.error('[Popup] Failed to restart recording:', restartError);
      showError('Recording failed and could not be restarted');
    }
  } else {
    showError('Recording error: ' + error.message);
  }
}

// Enhanced stop recording with proper cleanup
async function stopRecording() {
  console.log('[Popup] Stopping recording...');
  
  if (!recordingState.mediaRecorder || !recordingState.isRecording) {
    showError('Not currently recording');
    return;
  }
  
  return new Promise((resolve) => {
    recordingState.mediaRecorder.onstop = () => {
      // Create audio blob from chunks
      const audioBlob = new Blob(recordingState.audioChunks, { type: 'audio/webm' });
      recordingState.duration = Date.now() - recordingState.startTime;
      
      console.log('[Popup] Recording stopped. Size:', audioBlob.size, 'bytes');
      console.log('[Popup] Duration:', recordingState.duration, 'ms');
      
      recordingState.isRecording = false;
      stopTimer();
      
      // Stop all tracks
      if (recordingState.stream) {
        recordingState.stream.getTracks().forEach(track => track.stop());
        recordingState.stream = null;
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        recordingState.currentAudioBlob = reader.result;
        
        // Upload to backend via background script
        uploadAudioViaBackground(recordingState.currentAudioBlob, 'Google Meet Recording');
        
        resolve();
      };
      reader.readAsDataURL(audioBlob);
    };
    
    recordingState.mediaRecorder.stop();
  });
}

// Upload audio via background script
async function uploadAudioViaBackground(base64Audio, title) {
  console.log('[Popup] Uploading audio via background...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'uploadAudio',
        base64Audio: base64Audio,
        title: title
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
    
    showResults(response.result.ai_output);
  } catch (error) {
    console.error('[Popup] Upload error:', error);
    showError('Upload failed: ' + error.message);
  }
}

// Enhanced cleanup function
function cleanupRecordingResources() {
  console.log('[Popup] Cleaning up recording resources...');
  
  // Stop media recorder if active
  if (recordingState.mediaRecorder && recordingState.mediaRecorder.state !== 'inactive') {
    recordingState.mediaRecorder.stop();
  }
  
  // Stop all tracks
  if (recordingState.stream) {
    recordingState.stream.getTracks().forEach(track => track.stop());
    recordingState.stream = null;
  }
  
  // Clear timer
  if (recordingState.timer) {
    clearInterval(recordingState.timer);
    recordingState.timer = null;
  }
  
  // Reset state
  initializeRecordingState();
}

// Enhanced reset UI with cleanup
function resetUI() {
  cleanupRecordingResources();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.recordingSection.classList.remove('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';
  
  // Re-check meet status
  checkMeetStatus();
}

// Enhanced error handling and recovery
function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
  
  // Log error to background
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: message
  });
}

// Enhanced cleanup on page unload
document.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up before unload...');
  cleanupRecordingResources();
});

// Enhanced cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Popup] Extension is being suspended');
  cleanupRecordingResources();
});

// Enhanced reset UI with cleanup
function resetUI() {
  cleanupRecordingResources();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.recordingSection.classList.remove('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';
  
  // Re-check meet status
  checkMeetStatus();
}

// Enhanced error handling and recovery
function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
  
  // Log error to background
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: message
  });
}

// Enhanced cleanup on page unload
document.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up before unload...');
  cleanupRecordingResources();
});

// Enhanced cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Popup] Extension is being suspended');
  cleanupRecordingResources();
});

// Enhanced reset UI with cleanup
function resetUI() {
  cleanupRecordingResources();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.recordingSection.classList.remove('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';
  
  // Re-check meet status
  checkMeetStatus();
}

// Enhanced error handling and recovery
function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
  
  // Log error to background
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: message
  });
}

// Enhanced cleanup on page unload
document.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up before unload...');
  cleanupRecordingResources();
});

// Enhanced cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Popup] Extension is being suspended');
  cleanupRecordingResources();
});

// Enhanced reset UI with cleanup
function resetUI() {
  cleanupRecordingResources();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.recordingSection.classList.remove('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';
  
  // Re-check meet status
  checkMeetStatus();
}

// Enhanced error handling and recovery
function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
  
  // Log error to background
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: message
  });
}

// Enhanced cleanup on page unload
document.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up before unload...');
  cleanupRecordingResources();
});

// Enhanced cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Popup] Extension is being suspended');
  cleanupRecordingResources();
});

// Enhanced reset UI with cleanup
function resetUI() {
  cleanupRecordingResources();
  
  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.recordingSection.classList.remove('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';
  
  // Re-check meet status
  checkMeetStatus();
}

// Enhanced error handling and recovery
function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
  
  // Log error to background
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: message
  });
}

// Enhanced cleanup on page unload
document.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up before unload...');
  cleanupRecordingResources();
});

// Enhanced cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Popup] Extension is being suspended');
  cleanupRecordingResources();
});

// Start recording timer
function startTimer() {
  updateTimer();
  recordingState.timer = setInterval(updateTimer, 1000);
}

// Stop recording timer
function stopTimer() {
  if (recordingState.timer) {
    clearInterval(recordingState.timer);
    recordingState.timer = null;
  }
}

// Update timer display
function updateTimer() {
  if (!recordingState.startTime) return;
  
  recordingState.duration = Math.floor((Date.now() - recordingState.startTime) / 1000);
  const minutes = Math.floor(recordingState.duration / 60).toString().padStart(2, '0');
  const seconds = (recordingState.duration % 60).toString().padStart(2, '0');
  
  elements.recordingTimer.textContent = `${minutes}:${seconds}`;
}

// Handle file upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

// Process uploaded file
async function handleFile(file) {
  console.log('[Popup] File selected:', file.name);
  
  // Validate file type
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'video/mp4', 'audio/ogg'];
  if (!validTypes.includes(file.type)) {
    showError('Invalid file type: ' + file.type + '. Please upload MP3, WAV, MP4, WEBM, or OGG files.');
    return;
  }
  
  // Convert file to base64
  const reader = new FileReader();
  reader.onloadend = () => {
    recordingState.currentAudioBlob = reader.result;
    uploadAudioViaBackground(recordingState.currentAudioBlob, file.name);
  };
  reader.readAsDataURL(file);
}

// Show processing UI
function showProcessing() {
  elements.recordingSection.classList.add('hidden');
  elements.uploadSection.classList.add('hidden');
  elements.processingSection.classList.remove('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
}

// Show results UI
function showResults(summary) {
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.remove('hidden');
  
  // Format and display summary
  const html = formatSummary(summary);
  elements.summaryContent.innerHTML = html;
}

// Format summary for display
function formatSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return '<p class="error">Invalid summary format</p>';
  }
  
  let html = '';
  
  // Summary
  if (summary.summary) {
    html += `
      <div class="summary-section">
        <h3>📋 Summary</h3>
        <p>${escapeHtml(summary.summary)}</p>
      </div>
    `;
  }
  
  // Key Points
  if (summary.key_points && summary.key_points.length > 0) {
    html += `
      <div class="summary-section">
        <h3>🎯 Key Points</h3>
        <ul>
          ${summary.key_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  // Decisions
  if (summary.decisions && summary.decisions.length > 0) {
    html += `
      <div class="summary-section">
        <h3>✅ Decisions</h3>
        <ul>
          ${summary.decisions.map(decision => `<li>${escapeHtml(decision)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  // Action Items
  if (summary.action_items && summary.action_items.length > 0) {
    html += `
      <div class="summary-section">
        <h3>📝 Action Items</h3>
        <ul class="action-items">
          ${summary.action_items.map(item => `
            <li>
              <span class="task">${escapeHtml(item.task)}</span>
              <span class="owner">@${escapeHtml(item.owner)}</span>
              <span class="status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }
  
  // Agenda
  if (summary.agenda && summary.agenda.length > 0) {
    html += `
      <div class="summary-section">
        <h3>📑 Agenda</h3>
        <ol>
          ${summary.agenda.map(topic => `<li>${escapeHtml(topic)}</li>`).join('')}
        </ol>
      </div>
    `;
  }
  
  return html || '<p>No summary available</p>';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Download recorded audio
function downloadAudio() {
  if (!recordingState.currentAudioBlob) {
    showError('No audio to download');
    return;
  }
  
  const link = document.createElement('a');
  link.href = recordingState.currentAudioBlob;
  link.download = 'meeting-recording-' + Date.now() + '.webm';
  link.click();
  link.remove();
}

// View history
function viewHistory() {
  // Implementation for viewing history
  console.log('[Popup] View history clicked');
}

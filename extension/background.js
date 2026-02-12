// Background Service Worker
// Handles communication and state management

let isRecording = false;
let currentStream = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      isRecording: isRecording
    });
    return true;
  }
  
  if (request.action === 'requestRecordingPermission') {
    // Check if already recording
    if (isRecording) {
      sendResponse({
        granted: false,
        reason: 'Already recording'
      });
    } else {
      sendResponse({
        granted: true
      });
    }
    return true;
  }
  
  if (request.action === 'updateRecordingState') {
    isRecording = request.isRecording;
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'recordingStopped') {
    isRecording = false;
    console.log('[Background] Recording stopped after ' + request.duration + 'ms');
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'recordingError') {
    console.error('[Background] Recording error:', request.error);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'uploadAudio') {
    // Handle audio upload in background
    handleAudioUpload(request.base64Audio, request.title)
      .then(result => {
        sendResponse({ success: true, result: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Handle audio upload in background
async function handleAudioUpload(base64Audio, title) {
  console.log('[Background] Uploading audio...');
  
  try {
    // Convert base64 back to blob
    const response = await fetch(base64Audio);
    const audioBlob = await response.blob();
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', audioBlob, 'meeting-recording.webm');
    formData.append('title', title || 'Meeting Recording');
    formData.append('type', 'google_meet');
    
    // Send to backend
    const uploadResponse = await fetch('http://localhost:8000/meeting/create', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
    }
    
    const result = await uploadResponse.json();
    console.log('[Background] Upload successful:', result);
    return result;
  } catch (error) {
    console.error('[Background] Upload error:', error);
    throw error;
  }
}

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Meeting AI Recorder extension installed');
  
  // Initialize recording state
  isRecording = false;
  currentStream = null;
});

// Handle tab capture errors
chrome.tabCapture.onError.addListener((error) => {
  console.error('[Background] Tab capture error:', error);
  
  // Notify all popups
  chrome.runtime.sendMessage({
    action: 'recordingError',
    error: 'Tab capture error: ' + error.message
  });
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('meet.google.com')) {
    console.log('[Background] Google Meet tab loaded');
    
    // Check if we should resume recording
    if (isRecording) {
      console.log('[Background] Attempting to resume recording...');
      resumeRecording();
    }
  }
});

// Resume recording if needed
async function resumeRecording() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url.includes('meet.google.com')) {
      // Attempt to restart recording
      chrome.runtime.sendMessage({
        action: 'requestRecordingPermission'
      }, (response) => {
        if (response.granted) {
          // Trigger recording restart in popup
          chrome.runtime.sendMessage({
            action: 'restartRecording'
          });
        }
      });
    }
  } catch (error) {
    console.error('[Background] Failed to resume recording:', error);
  }
}

// Handle extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Background] Extension is being suspended');
  
  // Clean up resources
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
});

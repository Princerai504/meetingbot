// Background script for audio capture
let mediaRecorder = null;
let audioChunks = [];
let captureStream = null;
let isRecording = false;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    startRecording(sender.tab.id, sendResponse);
    return true; // Keep message channel open for async
  } else if (request.action === 'stopRecording') {
    stopRecording(sendResponse);
    return true;
  } else if (request.action === 'getStatus') {
    sendResponse({ isRecording });
  }
});

async function startRecording(tabId, sendResponse) {
  try {
    if (isRecording) {
      sendResponse({ success: false, error: 'Already recording' });
      return;
    }

    // Get tab audio stream
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
      consumerTabId: tabId
    });

    // Create stream from stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    captureStream = stream;
    audioChunks = [];

    // Create media recorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        // Send chunk to backend immediately
        sendAudioChunk(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      saveAudioFile(audioBlob);
      cleanup();
    };

    // Start recording with 10-second chunks for real-time processing
    mediaRecorder.start(10000);
    isRecording = true;

    sendResponse({ success: true, message: 'Recording started' });

  } catch (error) {
    console.error('Failed to start recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function stopRecording(sendResponse) {
  try {
    if (!isRecording || !mediaRecorder) {
      sendResponse({ success: false, error: 'Not recording' });
      return;
    }

    mediaRecorder.stop();
    isRecording = false;
    sendResponse({ success: true, message: 'Recording stopped' });

  } catch (error) {
    console.error('Failed to stop recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function cleanup() {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
  isRecording = false;
}

async function sendAudioChunk(blob) {
  // Send to backend WebSocket or HTTP endpoint
  const formData = new FormData();
  formData.append('audio', blob, 'chunk.webm');

  try {
    await fetch('http://localhost:8000/bot/audio-chunk', {
      method: 'POST',
      body: formData
    });
  } catch (error) {
    console.error('Failed to send audio chunk:', error);
  }
}

async function saveAudioFile(blob) {
  // Convert to WAV and save locally
  const formData = new FormData();
  formData.append('audio', blob, 'meeting.webm');
  formData.append('final', 'true');

  try {
    await fetch('http://localhost:8000/bot/save-audio', {
      method: 'POST',
      body: formData
    });
  } catch (error) {
    console.error('Failed to save audio file:', error);
  }
}
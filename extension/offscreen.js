// Offscreen Document Script
// Handles persistent MediaRecorder for audio capture.
// This document stays alive even when the popup closes.

let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.action) {
    case 'startRecording':
      startRecording(message.streamId)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // async response

    case 'stopRecording':
      stopRecording()
        .then(base64Audio => sendResponse({ success: true, base64Audio }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // async response

    case 'getRecordingStatus':
      sendResponse({
        isRecording: mediaRecorder !== null && mediaRecorder.state === 'recording',
        startTime: recordingStartTime
      });
      return true;
  }
});

async function startRecording(streamId) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    throw new Error('Already recording');
  }

  // Get the media stream from the stream ID provided by tabCapture
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  audioChunks = [];
  recordingStartTime = Date.now();

  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error('[Offscreen] MediaRecorder error:', event);
    chrome.runtime.sendMessage({
      source: 'offscreen',
      action: 'recordingError',
      error: event.error?.message || 'Unknown MediaRecorder error'
    });
  };

  // Start recording with 1-second chunks
  mediaRecorder.start(1000);
  console.log('[Offscreen] Recording started');
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    throw new Error('Not currently recording');
  }

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      // Stop all tracks to release the stream
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }

      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('[Offscreen] Recording stopped. Size:', audioBlob.size, 'bytes');

      // Convert blob to base64 data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result;
        // Clean up
        audioChunks = [];
        mediaRecorder = null;
        recordingStartTime = null;
        resolve(base64Audio);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert audio to base64'));
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.stop();
  });
}

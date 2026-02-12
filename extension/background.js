// Background Service Worker
// Manages offscreen document lifecycle, relays messages, and handles uploads

let isRecording = false;
let recordingStartTime = null;

// ─── Offscreen Document Management ─────────────────────────────────────────

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    return; // Already exists
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording tab audio for meeting summarization'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
  console.log('[Background] Offscreen document created');
}

async function closeOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
    console.log('[Background] Offscreen document closed');
  }
}

// ─── Message Handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // --- Status queries ---
  if (request.action === 'getStatus') {
    sendResponse({
      isRecording: isRecording,
      recordingStartTime: recordingStartTime
    });
    return true;
  }

  // --- Start recording: popup sends the streamId, we relay to offscreen ---
  if (request.action === 'startRecording') {
    (async () => {
      try {
        await ensureOffscreenDocument();

        const result = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'startRecording',
          streamId: request.streamId
        });

        if (result && result.success) {
          isRecording = true;
          recordingStartTime = Date.now();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: result?.error || 'Unknown error' });
        }
      } catch (error) {
        console.error('[Background] Start recording error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // async response
  }

  // --- Stop recording: relay to offscreen, get base64 audio back ---
  if (request.action === 'stopRecording') {
    (async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'stopRecording'
        });

        isRecording = false;
        const duration = recordingStartTime ? Date.now() - recordingStartTime : 0;
        recordingStartTime = null;

        if (result && result.success) {
          console.log('[Background] Recording stopped, duration:', duration, 'ms');
          sendResponse({
            success: true,
            base64Audio: result.base64Audio,
            duration: duration
          });
        } else {
          sendResponse({ success: false, error: result?.error || 'Unknown error' });
        }

        // Close offscreen document after recording is done
        await closeOffscreenDocument();
      } catch (error) {
        console.error('[Background] Stop recording error:', error);
        isRecording = false;
        recordingStartTime = null;
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // async response
  }

  // --- Upload audio to backend ---
  if (request.action === 'uploadAudio') {
    handleAudioUpload(request.base64Audio, request.title)
      .then(result => {
        sendResponse({ success: true, result: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // --- Offscreen recording error forwarded here ---
  if (request.source === 'offscreen' && request.action === 'recordingError') {
    console.error('[Background] Recording error from offscreen:', request.error);
    isRecording = false;
    recordingStartTime = null;
    return;
  }

  // --- Content script status updates (MEET_STATUS) ---
  if (request.type === 'MEET_STATUS') {
    // Store meet status if needed for future features
    console.log('[Background] Meet status update:', request.data?.isMeetPage ? 'On Meet' : 'Not on Meet');
    sendResponse({ received: true });
    return true;
  }
});

// ─── Audio Upload ───────────────────────────────────────────────────────────

async function handleAudioUpload(base64Audio, title) {
  console.log('[Background] Uploading audio...');

  try {
    // Convert base64 data URL to blob
    const base64Data = base64Audio.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/webm' });
    console.log('[Background] Blob created, size:', audioBlob.size, 'bytes');

    // Create FormData
    const formData = new FormData();
    formData.append('file', audioBlob, 'meeting-recording.webm');
    formData.append('title', title || 'Meeting Recording');
    formData.append('type', 'google_meet');

    console.log('[Background] Sending to backend...');

    // Send to backend
    const uploadResponse = await fetch('http://localhost:8000/meeting/create', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Background] Backend error response:', errorText);
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

// ─── Lifecycle Events ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Meeting AI Recorder extension installed');
  isRecording = false;
  recordingStartTime = null;
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('[Background] Extension is being suspended');
  isRecording = false;
  recordingStartTime = null;
});

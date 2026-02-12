// Popup Script - Controls the extension UI
// Recording is delegated to the offscreen document via background script

// UI state (not recording state — that lives in offscreen/background)
let timerInterval = null;
let recordingStartTime = null;
let currentAudioBase64 = null;

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

// ─── Initialize ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Extension popup opened');

  await checkBackendStatus();
  await checkMeetStatus();
  setupEventListeners();

  // Check if recording is already in progress (popup was reopened)
  await syncRecordingState();
});

// ─── Backend Status ─────────────────────────────────────────────────────────

async function checkBackendStatus() {
  try {
    const response = await fetch('http://localhost:8000/meetings', { method: 'GET' });

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

// ─── Meet Detection ─────────────────────────────────────────────────────────

async function checkMeetStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && tab.url.includes('meet.google.com')) {
      elements.statusIndicator.className = 'status-badge online';
      elements.statusText.textContent = 'On Google Meet';
      elements.recordingSection.classList.remove('hidden');
    } else {
      elements.statusIndicator.className = 'status-badge offline';
      elements.statusText.textContent = 'Not on Meet';
      elements.recordingSection.classList.add('hidden');
    }
  } catch (error) {
    console.error('[Popup] Error checking meet status:', error);
  }
}

// ─── Sync Recording State ───────────────────────────────────────────────────

async function syncRecordingState() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });

    if (status && status.isRecording) {
      // Recording is already in progress — update UI to reflect it
      recordingStartTime = status.recordingStartTime || Date.now();
      showRecordingUI();
    }
  } catch (error) {
    console.log('[Popup] Could not sync recording state:', error.message);
  }
}

// ─── Event Listeners ────────────────────────────────────────────────────────

function setupEventListeners() {
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

// ─── Recording (via offscreen document) ─────────────────────────────────────

async function startRecording() {
  console.log('[Popup] Starting recording...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('meet.google.com')) {
      showError('Please navigate to a Google Meet meeting first');
      return;
    }

    // Get a media stream ID for the current tab
    // In MV3, this must be called from the popup (user gesture context)
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    if (!streamId) {
      showError('Could not get audio stream. Make sure you are in a Google Meet meeting.');
      return;
    }

    console.log('[Popup] Got stream ID, sending to background...');

    // Send stream ID to background → offscreen for recording
    const result = await chrome.runtime.sendMessage({
      action: 'startRecording',
      streamId: streamId
    });

    if (result && result.success) {
      recordingStartTime = Date.now();
      showRecordingUI();
      console.log('[Popup] Recording started successfully');
    } else {
      showError('Failed to start recording: ' + (result?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('[Popup] Error starting recording:', error);
    showError('Error: ' + error.message);
  }
}

async function stopRecording() {
  console.log('[Popup] Stopping recording...');

  try {
    stopTimer();

    // Tell background → offscreen to stop recording and get the audio
    const result = await chrome.runtime.sendMessage({ action: 'stopRecording' });

    if (result && result.success && result.base64Audio) {
      currentAudioBase64 = result.base64Audio;
      console.log('[Popup] Got audio data, uploading...');

      // Show processing immediately, then upload
      showProcessing();
      await uploadAudioToBackend(result.base64Audio, 'Google Meet Recording');
    } else {
      showError('Failed to stop recording: ' + (result?.error || 'No audio data'));
    }
  } catch (error) {
    console.error('[Popup] Error stopping recording:', error);
    showError('Error stopping: ' + error.message);
  }
}

// ─── Upload ─────────────────────────────────────────────────────────────────

async function uploadAudioToBackend(base64Audio, title) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'uploadAudio',
      base64Audio: base64Audio,
      title: title
    });

    if (!response) {
      throw new Error('No response from background script');
    }

    if (response.success && response.result && response.result.ai_output) {
      showResults(response.result.ai_output);
    } else if (response.success && response.result) {
      // ai_output might not exist if backend returned differently
      showResults(response.result);
    } else {
      throw new Error(response.error || 'Upload failed');
    }
  } catch (error) {
    console.error('[Popup] Upload error:', error);
    showError('Upload failed: ' + error.message);
  }
}

// ─── File Upload ────────────────────────────────────────────────────────────

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) handleFile(file);
}

async function handleFile(file) {
  console.log('[Popup] File selected:', file.name);

  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'video/mp4', 'audio/ogg', 'video/webm'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|mp4|m4a|ogg)$/i)) {
    showError('Unsupported file type. Please upload MP3, WAV, MP4, WEBM, or OGG files.');
    return;
  }

  showProcessing();

  const reader = new FileReader();
  reader.onloadend = () => {
    currentAudioBase64 = reader.result;
    uploadAudioToBackend(reader.result, file.name);
  };
  reader.onerror = () => {
    showError('Failed to read file');
  };
  reader.readAsDataURL(file);
}

// ─── UI State Management ────────────────────────────────────────────────────

function showRecordingUI() {
  elements.startBtn.classList.add('hidden');
  elements.stopBtn.classList.remove('hidden');
  elements.recordingInfo.classList.remove('hidden');
  elements.uploadSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  startTimer();
}

function showProcessing() {
  elements.recordingSection.classList.add('hidden');
  elements.uploadSection.classList.add('hidden');
  elements.processingSection.classList.remove('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
}

function showResults(summary) {
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.remove('hidden');

  const html = formatSummary(summary);
  elements.summaryContent.innerHTML = html;
}

function showError(message) {
  elements.processingSection.classList.add('hidden');
  elements.errorSection.classList.remove('hidden');
  elements.errorText.textContent = message;
}

function resetUI() {
  stopTimer();
  currentAudioBase64 = null;
  recordingStartTime = null;

  elements.startBtn.classList.remove('hidden');
  elements.stopBtn.classList.add('hidden');
  elements.recordingInfo.classList.add('hidden');
  elements.uploadSection.classList.remove('hidden');
  elements.processingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');
  elements.recordingTimer.textContent = '00:00';

  checkMeetStatus();
}

// ─── Timer ──────────────────────────────────────────────────────────────────

function startTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimer() {
  if (!recordingStartTime) return;

  const elapsedSec = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
  const seconds = (elapsedSec % 60).toString().padStart(2, '0');

  elements.recordingTimer.textContent = `${minutes}:${seconds}`;
}

// ─── Summary Formatting ────────────────────────────────────────────────────

function formatSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return '<p class="error">Invalid summary format</p>';
  }

  let html = '';

  if (summary.summary) {
    html += `
      <div class="summary-section">
        <h3>📋 Summary</h3>
        <p>${escapeHtml(summary.summary)}</p>
      </div>
    `;
  }

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

  if (summary.decisions && summary.decisions.length > 0) {
    html += `
      <div class="summary-section">
        <h3>✅ Decisions</h3>
        <ul>
          ${summary.decisions.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (summary.action_items && summary.action_items.length > 0) {
    html += `
      <div class="summary-section">
        <h3>📝 Action Items</h3>
        <ul class="action-items">
          ${summary.action_items.map(item => `
            <li>
              <span class="task">${escapeHtml(item.task || '')}</span>
              <span class="owner">@${escapeHtml(item.owner || 'Unassigned')}</span>
              <span class="status ${(item.status || 'pending').toLowerCase()}">${escapeHtml(item.status || 'Pending')}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Download ───────────────────────────────────────────────────────────────

function downloadAudio() {
  if (!currentAudioBase64) {
    showError('No audio to download');
    return;
  }

  const link = document.createElement('a');
  link.href = currentAudioBase64;
  link.download = 'meeting-recording-' + Date.now() + '.webm';
  link.click();
  link.remove();
}

// ─── History ────────────────────────────────────────────────────────────────

function viewHistory() {
  chrome.tabs.create({ url: 'http://localhost:8000/meetings' });
}

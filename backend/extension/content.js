// Content script for Google Meet page interaction
(function() {
  'use strict';

  console.log('[Meeting Bot] Content script loaded');

  // Wait for page to fully load
  window.addEventListener('load', init);

  function init() {
    console.log('[Meeting Bot] Page loaded, initializing...');
    
    // Check if we're on a Google Meet page
    if (!window.location.href.includes('meet.google.com')) {
      return;
    }

    // Listen for messages from parent window (Playwright)
    window.addEventListener('message', handleWindowMessage);

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getPageInfo') {
        sendResponse({
          url: window.location.href,
          title: document.title,
          isInMeeting: checkIfInMeeting()
        });
      }
    });

    // Monitor for meeting start
    monitorMeetingStart();
  }

  function handleWindowMessage(event) {
    if (event.data.type === 'MEETING_BOT_COMMAND') {
      const { command } = event.data;
      
      switch (command) {
        case 'JOIN_MEETING':
          clickJoinButton();
          break;
        case 'START_RECORDING':
          startRecording();
          break;
        case 'STOP_RECORDING':
          stopRecording();
          break;
        case 'LEAVE_MEETING':
          clickLeaveButton();
          break;
        case 'GET_STATUS':
          reportStatus();
          break;
      }
    }
  }

  function checkIfInMeeting() {
    // Check for meeting UI elements
    const meetingUI = document.querySelector('[data-meeting-title], [jsname="r4nke"], .crqnQb');
    return !!meetingUI;
  }

  function monitorMeetingStart() {
    const observer = new MutationObserver((mutations) => {
      if (checkIfInMeeting()) {
        console.log('[Meeting Bot] Meeting started detected');
        window.parent.postMessage({
          type: 'MEETING_BOT_EVENT',
          event: 'MEETING_STARTED'
        }, '*');
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function clickJoinButton() {
    console.log('[Meeting Bot] Looking for join button...');
    
    // Try multiple selectors for the join button
    const selectors = [
      'button[jsname="Qx7bfe"]',
      'button[jsname="jgEBTc"]',
      '[aria-label="Join now"]',
      '[aria-label="Ask to join"]',
      'button[data-tooltip="Join now"]',
      'button[data-tooltip="Ask to join"]',
      '.VfPpkd-LgbsSe-OWXEXe-k8QpJ'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.disabled === false) {
        console.log('[Meeting Bot] Found join button:', selector);
        button.click();
        window.parent.postMessage({
          type: 'MEETING_BOT_EVENT',
          event: 'JOIN_CLICKED'
        }, '*');
        return true;
      }
    }

    console.log('[Meeting Bot] Join button not found or disabled');
    return false;
  }

  function clickLeaveButton() {
    console.log('[Meeting Bot] Looking for leave button...');
    
    const selectors = [
      'button[jsname="CQylAd"]',
      '[aria-label="Leave call"]',
      'button[data-tooltip="Leave call"]',
      '.VfPpkd-Bz112c-LgbsSe[aria-label*="Leave"]'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button) {
        console.log('[Meeting Bot] Found leave button:', selector);
        button.click();
        return true;
      }
    }

    return false;
  }

  function startRecording() {
    console.log('[Meeting Bot] Starting recording...');
    chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
      window.parent.postMessage({
        type: 'MEETING_BOT_EVENT',
        event: 'RECORDING_STATUS',
        data: response
      }, '*');
    });
  }

  function stopRecording() {
    console.log('[Meeting Bot] Stopping recording...');
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      window.parent.postMessage({
        type: 'MEETING_BOT_EVENT',
        event: 'RECORDING_STATUS',
        data: response
      }, '*');
    });
  }

  function reportStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      window.parent.postMessage({
        type: 'MEETING_BOT_EVENT',
        event: 'STATUS_REPORT',
        data: {
          isRecording: response.isRecording,
          isInMeeting: checkIfInMeeting()
        }
      }, '*');
    });
  }

  // Expose function for Playwright to call directly
  window.meetingBot = {
    clickJoinButton,
    clickLeaveButton,
    startRecording,
    stopRecording,
    checkIfInMeeting
  };

})();
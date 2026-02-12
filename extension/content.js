// Content script for Google Meet page detection and interaction
// This script runs in the context of Google Meet pages

(function () {
    'use strict';

    // Track if extension context is still valid
    let extensionContextValid = true;

    // Check if we can safely send messages
    function canSendMessage() {
        try {
            chrome.runtime.id;
            return extensionContextValid;
        } catch (err) {
            extensionContextValid = false;
            return false;
        }
    }

    // Check if we're on a Google Meet page
    function isGoogleMeetPage() {
        return window.location.hostname === 'meet.google.com' &&
            window.location.pathname.length > 1;
    }

    // Get meeting code from URL
    function getMeetingCode() {
        if (!isGoogleMeetPage()) return null;
        const path = window.location.pathname;
        return path.substring(1).split('?')[0];
    }

    // Get meeting title if available
    function getMeetingTitle() {
        const possibleSelectors = [
            '[data-meeting-title]',
            '[data-call-title]',
            '.meeting-title',
            '.call-title'
        ];

        for (const selector of possibleSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element && element.textContent) {
                    return element.textContent.trim();
                }
            } catch (e) {
                // Ignore invalid selector errors
            }
        }

        return getMeetingCode();
    }

    // Check if user is in an active meeting (not just the pre-join screen)
    function isInActiveMeeting() {
        // Simple check: look for the end-call button or mute buttons
        // These are reliable indicators across Meet UI updates
        const selectors = [
            '[aria-label*="microphone"]',
            '[aria-label*="camera"]',
            '[data-participant-id]'
        ];

        for (const selector of selectors) {
            try {
                if (document.querySelectorAll(selector).length > 0) {
                    return true;
                }
            } catch (e) {
                // Ignore invalid selector errors
            }
        }
        return false;
    }

    // Send status to background (fire-and-forget, no errors)
    function updateStatus() {
        const status = {
            isMeetPage: isGoogleMeetPage(),
            meetingCode: getMeetingCode(),
            meetingTitle: getMeetingTitle(),
            isInMeeting: isInActiveMeeting(),
            url: window.location.href
        };

        if (!canSendMessage()) return status;

        try {
            chrome.runtime.sendMessage({
                type: 'MEET_STATUS',
                data: status
            }, () => {
                // Suppress "Could not establish connection" errors
                if (chrome.runtime.lastError) {
                    const msg = chrome.runtime.lastError.message || '';
                    if (msg.includes('context') || msg.includes('Receiving end does not exist')) {
                        extensionContextValid = false;
                    }
                }
            });
        } catch (err) {
            if (err.message && err.message.includes('context')) {
                extensionContextValid = false;
            }
        }

        return status;
    }

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
            if (request.type === 'GET_MEET_STATUS') {
                sendResponse(updateStatus());
                return true;
            }
        } catch (err) {
            // Silently handle errors
        }
    });

    // Monitor for page changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(updateStatus, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Initial status update
    if (isGoogleMeetPage()) {
        setTimeout(updateStatus, 2000);
    }

    // Periodic status updates (every 10s instead of 5s to reduce noise)
    const statusUpdateInterval = setInterval(() => {
        if (!extensionContextValid) {
            clearInterval(statusUpdateInterval);
            return;
        }

        if (isGoogleMeetPage()) {
            updateStatus();
        }
    }, 10000);

    console.log('📹 Meeting AI Recorder: Content script loaded');
})();

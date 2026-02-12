// Content script for Google Meet page detection and interaction
// This script runs in the context of Google Meet pages

(function() {
    'use strict';

    // Check if we're on a Google Meet page
    function isGoogleMeetPage() {
        return window.location.hostname === 'meet.google.com' && 
               window.location.pathname.length > 1;
    }

    // Get meeting code from URL
    function getMeetingCode() {
        if (!isGoogleMeetPage()) return null;
        const path = window.location.pathname;
        // Remove leading slash and get meeting code
        return path.substring(1).split('?')[0];
    }

    // Get meeting title if available
    function getMeetingTitle() {
        // Try to find the meeting title in the page
        // Google Meet often shows the title in various places
        const possibleSelectors = [
            '[data-meeting-title]',
            '[data-call-title]',
            '.meeting-title',
            '.call-title',
            '[role="heading"]'
        ];

        for (const selector of possibleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                return element.textContent.trim();
            }
        }

        // Fallback to meeting code
        return getMeetingCode();
    }

    // Check if user is in an active meeting (not just the pre-join screen)
    function isInActiveMeeting() {
        // Look for indicators that we're in an actual meeting
        const meetingIndicators = [
            // Video grid or participant list
            '[data-participant-id]',
            '.participant',
            '[data-fps-participant]',
            // Meeting controls
            '[data-tooltip="Turn off microphone"]',
            '[data-tooltip="Turn off camera"]',
            '[aria-label*="microphone"]',
            '[aria-label*="camera"]',
            // Bottom control bar
            '.google-material-icons', // Meet uses material icons
            '[role="button"][aria-label*="call"]'
        ];

        return meetingIndicators.some(selector => {
            const elements = document.querySelectorAll(selector);
            return elements.length > 0;
        });
    }

    // Send status to popup/background
    function updateStatus() {
        const status = {
            isMeetPage: isGoogleMeetPage(),
            meetingCode: getMeetingCode(),
            meetingTitle: getMeetingTitle(),
            isInMeeting: isInActiveMeeting(),
            url: window.location.href
        };

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'MEET_STATUS',
            data: status
        }).catch(err => {
            // Extension might not be ready yet, that's okay
            console.log('Could not send status:', err);
        });

        return status;
    }

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'GET_MEET_STATUS') {
            sendResponse(updateStatus());
            return true;
        }

        if (request.type === 'JOIN_MEETING') {
            // This would be called if we needed to programmatically join
            // For now, we expect user to already be in the meeting
            sendResponse({ success: true, message: 'User should already be in meeting' });
            return true;
        }
    });

    // Monitor for page changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // Wait a bit for the page to settle
            setTimeout(updateStatus, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Initial status update
    if (isGoogleMeetPage()) {
        // Wait for page to fully load
        setTimeout(updateStatus, 2000);
    }

    // Periodic status updates while in meeting
    setInterval(() => {
        if (isGoogleMeetPage()) {
            updateStatus();
        }
    }, 5000);

    console.log('📹 Meeting Summarizer: Content script loaded');
})();

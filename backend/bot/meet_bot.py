"""
Google Meet Bot Service
Uses Playwright to automate Chrome and join Google Meet meetings
"""

import asyncio
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import websockets
import wave
import io

class MeetBot:
    """Bot that joins Google Meet meetings and captures audio"""
    
    def __init__(self, meeting_id: int, meet_url: str, meeting_title: str):
        self.meeting_id = meeting_id
        self.meet_url = meet_url
        self.meeting_title = meeting_title
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_recording = False
        self.audio_chunks = []
        self.transcript = []
        self.extension_path = os.path.join(os.path.dirname(__file__), '..', 'extension')
        
    async def start(self):
        """Start the bot and join the meeting"""
        try:
            async with async_playwright() as p:
                # Launch browser with extension
                self.browser = await p.chromium.launch(
                    headless=False,  # Must be visible to avoid detection
                    args=[
                        f'--disable-extensions-except={self.extension_path}',
                        f'--load-extension={self.extension_path}',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',  # Safe for local use
                        '--disable-gpu'
                    ]
                )
                
                # Create context with permissions
                self.context = await self.browser.new_context(
                    permissions=['microphone', 'camera'],
                    viewport={'width': 1280, 'height': 720}
                )
                
                # Create new page
                self.page = await self.context.new_page()
                
                # Navigate to Google Meet
                await self.page.goto(self.meet_url)
                print(f"[Bot {self.meeting_id}] Navigated to {self.meet_url}")
                
                # Wait for page to load
                await asyncio.sleep(3)
                
                # Dismiss any initial dialogs
                await self._dismiss_dialogs()
                
                # Turn off camera and microphone before joining
                await self._disable_camera_mic()
                
                # Try to join the meeting
                joined = await self._join_meeting()
                if not joined:
                    raise Exception("Failed to join meeting")
                
                print(f"[Bot {self.meeting_id}] Successfully joined meeting")
                
                # Start recording
                await self._start_recording()
                
                # Keep browser open while recording
                while self.is_recording:
                    await asyncio.sleep(1)
                    
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error: {e}")
            raise
        finally:
            await self.cleanup()
    
    async def _dismiss_dialogs(self):
        """Dismiss any popup dialogs"""
        try:
            # Handle "Use microphone and camera" dialog
            dismiss_button = await self.page.query_selector('button:has-text("Dismiss")')
            if dismiss_button:
                await dismiss_button.click()
                await asyncio.sleep(1)
            
            # Handle "Know your rights" dialog
            got_it_button = await self.page.query_selector('button:has-text("Got it")')
            if got_it_button:
                await got_it_button.click()
                await asyncio.sleep(1)
                
        except Exception as e:
            print(f"[Bot {self.meeting_id}] No dialogs to dismiss or error: {e}")
    
    async def _disable_camera_mic(self):
        """Turn off camera and microphone before joining"""
        try:
            # Click camera button to turn it off
            camera_button = await self.page.query_selector('[aria-label="Turn off camera"]')
            if camera_button:
                await camera_button.click()
                print(f"[Bot {self.meeting_id}] Camera turned off")
                await asyncio.sleep(0.5)
            
            # Click microphone button to turn it off  
            mic_button = await self.page.query_selector('[aria-label="Turn off microphone"]')
            if mic_button:
                await mic_button.click()
                print(f"[Bot {self.meeting_id}] Microphone turned off")
                await asyncio.sleep(0.5)
                
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error disabling camera/mic: {e}")
    
    async def _join_meeting(self) -> bool:
        """Click the join button to enter the meeting"""
        try:
            # Wait for join button to appear
            join_button = await self.page.wait_for_selector(
                'button[jsname="Qx7bfe"], button[jsname="jgEBTc"], [aria-label="Join now"], [aria-label="Ask to join"]',
                timeout=10000
            )
            
            if join_button:
                # Check if button is enabled
                is_disabled = await join_button.get_attribute('disabled')
                if is_disabled:
                    print(f"[Bot {self.meeting_id}] Join button is disabled, waiting...")
                    await asyncio.sleep(3)
                
                await join_button.click()
                print(f"[Bot {self.meeting_id}] Clicked join button")
                
                # Wait for meeting to load
                await asyncio.sleep(5)
                
                # Check if we're in the meeting
                in_meeting = await self.page.query_selector('[data-meeting-title], .crqnQb')
                return in_meeting is not None
            else:
                print(f"[Bot {self.meeting_id}] Join button not found")
                return False
                
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error joining meeting: {e}")
            return False
    
    async def _start_recording(self):
        """Start audio recording via Chrome extension"""
        try:
            # Send message to extension via page
            await self.page.evaluate('''() => {
                window.postMessage({
                    type: 'MEETING_BOT_COMMAND',
                    command: 'START_RECORDING'
                }, '*');
            }''')
            
            self.is_recording = True
            print(f"[Bot {self.meeting_id}] Recording started")
            
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error starting recording: {e}")
            raise
    
    async def stop_recording(self):
        """Stop recording and save audio"""
        try:
            if not self.is_recording:
                return
            
            # Send stop command to extension
            await self.page.evaluate('''() => {
                window.postMessage({
                    type: 'MEETING_BOT_COMMAND',
                    command: 'STOP_RECORDING'
                }, '*');
            }''')
            
            self.is_recording = False
            print(f"[Bot {self.meeting_id}] Recording stopped")
            
            # Leave the meeting
            await self._leave_meeting()
            
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error stopping recording: {e}")
    
    async def _leave_meeting(self):
        """Click leave button to exit meeting"""
        try:
            leave_button = await self.page.query_selector(
                'button[jsname="CQylAd"], [aria-label="Leave call"]'
            )
            if leave_button:
                await leave_button.click()
                print(f"[Bot {self.meeting_id}] Left meeting")
                await asyncio.sleep(2)
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Error leaving meeting: {e}")
    
    async def cleanup(self):
        """Clean up browser resources"""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            print(f"[Bot {self.meeting_id}] Cleanup completed")
        except Exception as e:
            print(f"[Bot {self.meeting_id}] Cleanup error: {e}")


class BotManager:
    """Manages active bot instances"""
    
    def __init__(self):
        self.active_bots: Dict[int, MeetBot] = {}
    
    async def start_bot(self, meeting_id: int, meet_url: str, meeting_title: str) -> MeetBot:
        """Start a new bot instance"""
        if meeting_id in self.active_bots:
            raise Exception(f"Bot already running for meeting {meeting_id}")
        
        bot = MeetBot(meeting_id, meet_url, meeting_title)
        self.active_bots[meeting_id] = bot
        
        # Start bot in background
        asyncio.create_task(bot.start())
        
        return bot
    
    async def stop_bot(self, meeting_id: int):
        """Stop a running bot"""
        if meeting_id not in self.active_bots:
            raise Exception(f"No bot running for meeting {meeting_id}")
        
        bot = self.active_bots[meeting_id]
        await bot.stop_recording()
        del self.active_bots[meeting_id]
    
    def get_bot_status(self, meeting_id: int) -> dict:
        """Get status of a bot"""
        if meeting_id not in self.active_bots:
            return {"running": False}
        
        bot = self.active_bots[meeting_id]
        return {
            "running": True,
            "recording": bot.is_recording,
            "url": bot.meet_url
        }


# Global bot manager instance
bot_manager = BotManager()
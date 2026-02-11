import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Mic, Square, Loader2 } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import styles from './BotController.module.css';

const BotController = ({ meetingTitle, meetingType, onSuccess }) => {
    const [meetUrl, setMeetUrl] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [meetingId, setMeetingId] = useState(null);
    const [error, setError] = useState('');

    const handleJoinMeeting = async () => {
        if (!meetUrl.trim()) {
            setError('Please enter a Google Meet URL');
            return;
        }

        if (!meetUrl.includes('meet.google.com')) {
            setError('Please enter a valid Google Meet URL');
            return;
        }

        setIsJoining(true);
        setError('');

        try {
            const response = await fetch('http://localhost:8000/bot/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meet_url: meetUrl,
                    meeting_title: meetingTitle,
                    meeting_type: meetingType
                })
            });

            const data = await response.json();

            if (data.success) {
                setMeetingId(data.meeting_id);
                setIsRecording(true);
                onSuccess?.(data.meeting_id);
            } else {
                setError(data.error || 'Failed to start bot');
            }
        } catch (err) {
            setError('Network error. Is the backend running?');
        } finally {
            setIsJoining(false);
        }
    };

    const handleStopRecording = async () => {
        if (!meetingId) return;

        setIsJoining(true);

        try {
            const response = await fetch(`http://localhost:8000/bot/leave/${meetingId}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                setIsRecording(false);
                // Navigate to summary page
                window.location.href = `/summary/${meetingId}`;
            } else {
                setError(data.error || 'Failed to stop recording');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.container}
        >
            <div className={styles.header}>
                <Video size={24} className={styles.icon} />
                <h3 className={styles.title}>Google Meet Bot</h3>
            </div>

            <p className={styles.description}>
                The bot will join your Google Meet meeting as a guest, record the audio, 
                and generate a summary automatically.
            </p>

            {!isRecording ? (
                <div className={styles.inputSection}>
                    <Input
                        id="meetUrl"
                        label="Google Meet URL"
                        placeholder="https://meet.google.com/abc-defg-hij"
                        value={meetUrl}
                        onChange={(e) => setMeetUrl(e.target.value)}
                        disabled={isJoining}
                    />

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={styles.error}
                        >
                            {error}
                        </motion.p>
                    )}

                    <Button
                        onClick={handleJoinMeeting}
                        isLoading={isJoining}
                        disabled={!meetUrl.trim() || isJoining}
                        className={styles.joinButton}
                    >
                        <Video size={18} />
                        {isJoining ? 'Joining...' : 'Join & Record Meeting'}
                    </Button>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={styles.recordingSection}
                >
                    <div className={styles.recordingIndicator}>
                        <div className={styles.pulseRing} />
                        <div className={styles.recordingDot} />
                        <span className={styles.recordingText}>
                            Recording in progress...
                        </span>
                    </div>

                    <div className={styles.statusCard}>
                        <div className={styles.statusItem}>
                            <Mic size={16} />
                            <span>Audio capture active</span>
                        </div>
                        <div className={styles.statusItem}>
                            <Video size={16} />
                            <span>Bot joined as guest</span>
                        </div>
                    </div>

                    <p className={styles.instructions}>
                        Keep this window open. The bot is recording your meeting.
                        Click "Stop & Generate Summary" when the meeting ends.
                    </p>

                    <Button
                        variant="danger"
                        onClick={handleStopRecording}
                        isLoading={isJoining}
                        disabled={isJoining}
                        className={styles.stopButton}
                    >
                        <Square size={18} fill="currentColor" />
                        {isJoining ? 'Processing...' : 'Stop & Generate Summary'}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
};

export default BotController;
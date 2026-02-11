import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, Video } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import FileUpload from '../components/FileUpload';
import BotController from '../components/BotController';
import styles from './CreateMeeting.module.css';

import { api } from '../services/api';

const CreateMeeting = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('upload');
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        type: 'team_meeting',
        transcript: '',
        file: null
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleFileSelect = (file) => {
        setFormData(prev => ({ ...prev, file }));
    };

    /* 
   * Updated to use real backend API 
   */

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("[FRONTEND] handleSubmit called");
        console.log("[FRONTEND] Form data:", formData);
        setIsLoading(true);

        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('type', formData.type);
            if (formData.transcript) {
                data.append('transcript', formData.transcript);
                console.log("[FRONTEND] Adding transcript to form data");
            }
            if (formData.file) {
                data.append('file', formData.file);
                console.log("[FRONTEND] Adding file to form data:", formData.file.name);
            }

            console.log("[FRONTEND] Calling api.createMeeting...");
            const result = await api.createMeeting(data);
            console.log("[FRONTEND] Meeting created, result:", result);
            console.log("[FRONTEND] Navigating to summary page:", `/summary/${result.id}`);

            navigate(`/summary/${result.id}`);
        } catch (error) {
            console.error("[FRONTEND] Failed to create meeting:", error);
            alert("Failed to create meeting. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const meetingTypes = [
        { value: 'team_meeting', label: 'Team Meeting' },
        { value: 'interview', label: 'Interview' },
        { value: 'client_call', label: 'Client Call' },
        { value: 'stand_up', label: 'Stand Up' }
    ];

    return (
        <div className="container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={styles.pageWrapper}
            >
                <div className={styles.header}>
                    <h1 className={styles.title}>Create New Meeting</h1>
                    <p className={styles.subtitle}>Upload a recording, paste a transcript, or use the bot to join a Google Meet.</p>
                </div>

                <div className={styles.formCard}>
                    <div className={styles.formSection}>
                        <Input
                            id="title"
                            label="Meeting Title"
                            placeholder="e.g. Weekly Sync - Q4 Planning"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                        />

                        <Select
                            id="type"
                            label="Meeting Type"
                            options={meetingTypes}
                            value={formData.type}
                            onChange={handleInputChange}
                        />
                    </div>

                    {/* Tab Navigation */}
                    <div className={styles.tabContainer}>
                        <button
                            className={`${styles.tab} ${activeTab === 'upload' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            <Upload size={18} />
                            Upload / Paste
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'bot' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('bot')}
                        >
                            <Video size={18} />
                            Google Meet Bot
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'upload' ? (
                        <form onSubmit={handleSubmit}>
                            <div className={styles.divider}>
                                <span>Upload or Paste</span>
                            </div>

                            <div className={styles.uploadSection}>
                                <FileUpload
                                    label="Upload Recording"
                                    onFileSelect={handleFileSelect}
                                />

                                <div className={styles.orText}>OR</div>

                                <div className={styles.textAreaWrapper}>
                                    <label htmlFor="transcript" className={styles.label}>Paste Transcript</label>
                                    <textarea
                                        id="transcript"
                                        className={styles.textarea}
                                        placeholder="Paste the meeting transcript here..."
                                        rows={6}
                                        value={formData.transcript}
                                        onChange={handleInputChange}
                                        disabled={!!formData.file}
                                    />
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <Button
                                    type="submit"
                                    size="lg"
                                    isLoading={isLoading}
                                    className={styles.submitBtn}
                                    disabled={!formData.title || (!formData.transcript && !formData.file)}
                                >
                                    {isLoading ? 'Generating Summary...' : 'Generate Summary'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <BotController
                            meetingTitle={formData.title}
                            meetingType={formData.type}
                        />
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default CreateMeeting;

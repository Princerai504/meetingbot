import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Trash2, Eye, Calendar, Clock } from 'lucide-react';
import Button from '../components/Button';
import Select from '../components/Select';
import { api } from '../services/api';
import styles from './MeetingHistory.module.css';

const MeetingHistory = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            const data = await api.getMeetings();
            // Transform for display
            const formatted = data.map(m => ({
                id: m.id,
                title: m.title,
                date: new Date(m.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
                time: new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                type: m.type,
                // Duration is not currently tracked by backend, hiding or default
                duration: ''
            }));
            setMeetings(formatted);
        } catch (error) {
            console.error("Failed to fetch meetings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this meeting record?')) {
            try {
                await api.deleteMeeting(id);
                setMeetings(prev => prev.filter(m => m.id !== id));
            } catch (error) {
                console.error("Failed to delete meeting:", error);
                alert("Failed to delete meeting.");
            }
        }
    };

    const handleView = (meeting) => {
        // Navigate using ID now, not state
        navigate(`/summary/${meeting.id}`);
    };

    const filteredMeetings = meetings.filter(meeting => {
        const matchesSearch = meeting.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || meeting.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const meetingTypes = [
        { value: 'all', label: 'All Types' },
        { value: 'team_meeting', label: 'Team Meeting' },
        { value: 'interview', label: 'Interview' },
        { value: 'client_call', label: 'Client Call' },
        { value: 'stand_up', label: 'Stand Up' }
    ];

    return (
        <div className="container">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.pageWrapper}
            >
                <div className={styles.header}>
                    <h1 className={styles.title}>Meeting History</h1>
                    <p className={styles.subtitle}>Manage and review your past meeting summaries.</p>
                </div>

                <div className={styles.controls}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={18} />
                        <input
                            type="text"
                            placeholder="Search meetings..."
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.filterWrapper}>
                        <Select
                            options={meetingTypes}
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.list}>
                    <AnimatePresence>
                        {filteredMeetings.length > 0 ? (
                            filteredMeetings.map((meeting) => (
                                <motion.div
                                    key={meeting.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    layout
                                    className={styles.listItem}
                                >
                                    <div className={styles.itemContent}>
                                        <div className={styles.itemMain}>
                                            <h3 className={styles.itemTitle}>{meeting.title}</h3>
                                            <div className={styles.itemMeta}>
                                                <span className={styles.metaItem}><Calendar size={14} /> {meeting.date}</span>
                                                <span className={styles.metaItem}><Clock size={14} /> {meeting.time} ({meeting.duration})</span>
                                                <span className={`${styles.typeBadge} ${styles[meeting.type]} `}>
                                                    {meeting.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.itemActions}>
                                        <Button variant="ghost" size="sm" onClick={() => handleView(meeting)}>
                                            <Eye size={18} /> View
                                        </Button>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDelete(meeting.id)}
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={styles.emptyState}
                            >
                                <p>No meetings found matching your criteria.</p>
                                <Button variant="ghost" onClick={() => { setSearchTerm(''); setFilterType('all'); }}>
                                    Clear Filters
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default MeetingHistory;

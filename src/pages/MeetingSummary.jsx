import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, CheckCircle, List, ArrowLeft, Calendar, FileText } from 'lucide-react';
import Button from '../components/Button';
import { api } from '../services/api';
import styles from './MeetingSummary.module.css';

const MeetingSummary = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMeeting = async () => {
            try {
                const meeting = await api.getMeeting(id);

                // Transform backend data to frontend format if needed
                // Assuming backend returns { title, timestamp, ai_output: { summary, key_points... } }
                const formattedData = {
                    title: meeting.title,
                    date: new Date(meeting.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                    summary: meeting.ai_output?.summary || "No summary available.",
                    keyPoints: meeting.ai_output?.key_points || [],
                    decisions: meeting.ai_output?.decisions || [],
                    actionItems: meeting.ai_output?.action_items || []
                };

                setData(formattedData);
            } catch (err) {
                console.error("Failed to load meeting:", err);
                setError("Failed to load meeting details.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchMeeting();
        }
    }, [id]);

    if (loading) return <div className="container">Loading...</div>;
    if (error) return <div className="container">{error}</div>;
    if (!data) return null;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const handleDownload = () => {
        const textContent = `
Meeting Summary: ${data.title}
Date: ${data.date}

SUMMARY
${data.summary}

KEY POINTS
${data.keyPoints.map(p => `- ${p}`).join('\n')}

DECISIONS
${data.decisions.map(d => `- ${d}`).join('\n')}

ACTION ITEMS
${data.actionItems.map(i => `[${i.status}] ${i.task} (${i.owner})`).join('\n')}
`;

        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title.replace(/\s+/g, '_')} _summary.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container">
            <motion.div
                className={styles.pageWrapper}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants} className={styles.header}>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')} className={styles.backBtn}>
                        <ArrowLeft size={16} /> Back to Create
                    </Button>
                    <div className={styles.headerContent}>
                        <div>
                            <h1 className={styles.title}>{data.title}</h1>
                            <div className={styles.meta}>
                                <span className={styles.date}><Calendar size={14} /> {data.date}</span>
                                <span className={styles.tag}>Completed</span>
                            </div>
                        </div>
                        <Button onClick={handleDownload}>
                            <Download size={18} /> Download Summary
                        </Button>
                    </div>
                </motion.div>

                <div className={styles.grid}>
                    {/* Main Content */}
                    <div className={styles.mainColumn}>
                        <motion.section variants={itemVariants} className="card">
                            <h2 className={styles.sectionTitle}>
                                <div className={styles.iconWrapper}><FileText size={20} /></div>
                                Executive Summary
                            </h2>
                            <p className={styles.summaryText}>{data.summary}</p>
                        </motion.section>

                        <motion.section variants={itemVariants} className="card">
                            <h2 className={styles.sectionTitle}>
                                <div className={styles.iconWrapper}><CheckCircle size={20} /></div>
                                Action Items
                            </h2>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Owner</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.actionItems.map(item => (
                                            <tr key={item.id}>
                                                <td>{item.task}</td>
                                                <td>
                                                    <span className={styles.avatar}>{item.owner[0]}</span>
                                                    {item.owner}
                                                </td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${styles[item.status.toLowerCase().replace(' ', '')]} `}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.section>
                    </div>

                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        <motion.section variants={itemVariants} className="card">
                            <h2 className={styles.sectionTitle}>
                                <div className={styles.iconWrapper}><List size={20} /></div>
                                Key Points
                            </h2>
                            <ul className={styles.list}>
                                {data.keyPoints.map((point, i) => (
                                    <li key={i}>{point}</li>
                                ))}
                            </ul>
                        </motion.section>

                        <motion.section variants={itemVariants} className="card">
                            <h2 className={styles.sectionTitle}>
                                <div className={styles.iconWrapper}><CheckCircle size={20} /></div>
                                Decisions
                            </h2>
                            <ul className={styles.list}>
                                {data.decisions.map((decision, i) => (
                                    <li key={i} className={styles.decisionItem}>{decision}</li>
                                ))}
                            </ul>
                        </motion.section>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default MeetingSummary;

import React, { useRef, useState } from 'react';
import { UploadCloud, File, X } from 'lucide-react';
import styles from './FileUpload.module.css';

const FileUpload = ({ onFileSelect, accept = "video/mp4,audio/mp3,audio/wav", label }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files[0]);
        }
    };

    const handleFiles = (file) => {
        // Simple validation could go here
        setSelectedFile(file);
        onFileSelect(file);
    };

    const clearFile = () => {
        setSelectedFile(null);
        onFileSelect(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className={styles.wrapper}>
            {label && <label className={styles.label}>{label}</label>}

            {!selectedFile ? (
                <div
                    className={`${styles.dropZone} ${dragActive ? styles.active : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className={styles.input}
                        accept={accept}
                        onChange={handleChange}
                    />
                    <UploadCloud className={styles.icon} size={32} />
                    <p className={styles.text}>
                        <span className={styles.highlight}>Click to upload</span> or drag and drop
                    </p>
                    <p className={styles.subtext}>MP4, MP3, WAV (max. 100MB)</p>
                </div>
            ) : (
                <div className={styles.fileCard}>
                    <div className={styles.fileInfo}>
                        <div className={styles.fileIconWrapper}>
                            <File size={20} />
                        </div>
                        <div className={styles.fileDetails}>
                            <p className={styles.fileName}>{selectedFile.name}</p>
                            <p className={styles.fileSize}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button onClick={clearFile} className={styles.removeBtn} type="button">
                        <X size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileUpload;

import React from 'react';
import styles from './Input.module.css';

const Input = ({ label, error, id, ...props }) => {
    return (
        <div className={styles.wrapper}>
            {label && <label htmlFor={id} className={styles.label}>{label}</label>}
            <input
                id={id}
                className={`${styles.input} ${error ? styles.errorInput : ''}`}
                {...props}
            />
            {error && <span className={styles.errorText}>{error}</span>}
        </div>
    );
};

export default Input;

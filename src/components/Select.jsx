import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

const Select = ({ label, error, id, options = [], ...props }) => {
    return (
        <div className={styles.wrapper}>
            {label && <label htmlFor={id} className={styles.label}>{label}</label>}
            <div className={styles.selectWrapper}>
                <select
                    id={id}
                    className={`${styles.select} ${error ? styles.errorInput : ''}`}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className={styles.icon} size={16} />
            </div>
            {error && <span className={styles.errorText}>{error}</span>}
        </div>
    );
};

export default Select;

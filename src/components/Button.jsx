import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    className = '',
    ...props
}) => {
    return (
        <button
            className={`
        ${styles.btn} 
        ${styles[variant]} 
        ${styles[size]} 
        ${className}
      `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className={styles.spinner} size={18} />}
            {children}
        </button>
    );
};

export default Button;

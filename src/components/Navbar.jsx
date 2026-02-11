import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Plus, History } from 'lucide-react';
import styles from './Navbar.module.css';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.container}`}>
        <Link to="/" className={styles.logo}>
          <div className={styles.iconWrapper}>
            <FileText size={24} color="white" />
          </div>
          <span className={styles.brandName}>QuickMeet</span>
        </Link>
        
        <div className={styles.links}>
          <Link 
            to="/" 
            className={`${styles.link} ${location.pathname === '/' ? styles.active : ''}`}
          >
            <Plus size={18} />
            <span>New Meeting</span>
          </Link>
          <Link 
            to="/history" 
            className={`${styles.link} ${location.pathname === '/history' ? styles.active : ''}`}
          >
            <History size={18} />
            <span>History</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

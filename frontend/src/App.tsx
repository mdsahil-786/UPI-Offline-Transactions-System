import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from './features/admin/AdminPage';
import styles from './App.module.css';

// Add one entry here as each later phase lands (Wallet, Security Lab, Simulation...).
const NAV_ITEMS = [{ to: '/admin', label: 'Admin' }];

export function App() {
    return (
        <>
            <header className={styles.nav}>
                <span className={styles.brand}>📡 UPI Offline Mesh</span>
                <nav className={styles.links}>
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                isActive ? `${styles.link} ${styles.active}` : styles.link
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main>
                <Routes>
                    <Route path="/" element={<Navigate to="/admin" replace />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<div className="page">Page not found.</div>} />
                </Routes>
            </main>
        </>
    );
}
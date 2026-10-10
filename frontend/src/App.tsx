import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from './features/admin/AdminPage';
import { WalletPage } from './features/wallet/WalletPage';
import styles from './App.module.css';

const NAV_ITEMS = [
    { to: '/wallet', label: 'Wallet' },
    { to: '/admin', label: 'Admin' },
];


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
                    <Route path="/" element={<Navigate to="/wallet" replace />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<div className="page">Page not found.</div>} />
                </Routes>
            </main>
        </>
    );
}
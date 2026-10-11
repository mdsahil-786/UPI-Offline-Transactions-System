import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from './features/admin/AdminPage';
import { WalletPage } from './features/wallet/WalletPage';
import styles from './App.module.css';
import { SecurityLabPage } from './features/security/SecurityLabPage';

import { SimulationPage } from './features/simulation/SimulationPage';

const NAV_ITEMS = [
    { to: '/wallet', label: 'Wallet' },
    { to: '/simulation', label: 'Simulation' },
    { to: '/security', label: 'Security Lab' },
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
                    <Route path="/security" element={<SecurityLabPage />} />
                    <Route path="/simulation" element={<SimulationPage />} />
                </Routes>
            </main>
        </>
    );
}
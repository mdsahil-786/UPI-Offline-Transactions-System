import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Tokens must load before global.css, which reads them via var(--...).
import './styles/tokens.css';
import './styles/global.css';
import './crypto/smokeTest';

import { App } from './App';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // fail fast when Spring Boot is down
            refetchOnWindowFocus: false,
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
);
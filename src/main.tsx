import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SapAuthProvider } from './core/auth/sapAuthContext';
import { ToastProvider } from './shared/context/ToastContext';
import App from './App';
import './index.css';

// Initialize TanStack Query Client for SAP OData V4 caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent redundant calls to SAP Gateway
      retry: 1,
      staleTime: 1000 * 60 * 5 // 5 minutes cache
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SapAuthProvider>
          <App />
        </SapAuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

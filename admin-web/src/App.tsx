import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/client';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { AppRoutes } from './routes';
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      // Admin data changes often enough that a short window is right, but not
      // so often that every tab switch should refetch.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx responses are not going to change on a retry; transport and
        // server errors might.
        if (error instanceof ApiError && !error.isRetryable) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Vite's `base` (see vite.config.ts) arrives as e.g. "/admin/"; React Router
// wants it without the trailing slash, and an empty string at the site root.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

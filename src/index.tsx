import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider } from './features/auth/AuthProvider';

import { PullToRefreshProvider } from './pullToRefresh/PullToRefreshProvider';
import { globalRefresh } from './refresh/globalRefresh';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <PullToRefreshProvider
          onRefresh={globalRefresh}
          isEnabled={() => {
            const path = window.location.pathname;
            // чаты — отключаем
            if (path.startsWith('/dreams/') && path.includes('/chat')) return false;
            if (path.startsWith('/daily/') && path.includes('/chat')) return false;
            return true;
          }}
        >
          <App />
        </PullToRefreshProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
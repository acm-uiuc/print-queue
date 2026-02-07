import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import '@ungap/with-resolvers';
import '@mantine/core/styles.css';
import { AuthProvider } from '@/auth/AuthContext';
import { PrintJobsProvider } from '@/print/PrintJobsContext';
import { authConfigError, initializeMsal, pca } from '@/auth/msalConfig';

async function bootstrapMsal() {
  try {
    await initializeMsal();
  } catch (error) {
    console.error('Failed to initialize MSAL', error);
  }
}

bootstrapMsal().finally(() => {
  if (authConfigError) {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          background: '#f6f8fc',
          color: '#0f172a',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: '760px',
            background: '#fff',
            border: '1px solid #dbe2ea',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.125rem' }}>App configuration error</h1>
          <p style={{ margin: '0.75rem 0 0' }}>{authConfigError}</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Create or update <code>.env</code>, then restart the dev server.
          </p>
        </section>
      </main>
    );
    return;
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <MsalProvider instance={pca}>
      <AuthProvider>
        <PrintJobsProvider>
          <MantineProvider
            theme={{
              colors: {
                acmBlue: [
                  '#e6f0ff',
                  '#ccdfff',
                  '#99bfff',
                  '#669fff',
                  '#3380ff',
                  '#0053b3',
                  '#004899',
                  '#003d80',
                  '#003166',
                  '#00264d',
                ],
              },
              primaryColor: 'acmBlue',
              defaultRadius: 'xl',
            }}
          >
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </MantineProvider>
        </PrintJobsProvider>
      </AuthProvider>
    </MsalProvider>
  );
});

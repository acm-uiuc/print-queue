import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MsalProvider } from '@azure/msal-react';
import { type Configuration, PublicClientApplication } from '@azure/msal-browser';
import App from './App';
import '@ungap/with-resolvers';
import '@mantine/core/styles.css';
import { AuthProvider } from '@/auth/AuthContext';
import { PrintJobsProvider } from '@/print/PrintJobsContext';

const DEFAULT_REDIRECT_URI = 'http://localhost:5173/print';

const clientId = (import.meta.env.VITE_AAD_CLIENT_ID as string | undefined)?.trim() ?? '';
const tenantId = (import.meta.env.VITE_AAD_TENANT_ID as string | undefined)?.trim() ?? '';
const explicitAuthority = (import.meta.env.VITE_AAD_AUTHORITY as string | undefined)?.trim();

const resolvedAuthority =
  explicitAuthority && explicitAuthority.length > 0
    ? explicitAuthority.trim()
    : tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : 'https://login.microsoftonline.com/common';

const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const defaultRedirectUri = appOrigin ? `${appOrigin}/` : '/';
const defaultLogoutRedirectUri = appOrigin ? `${appOrigin}/login` : '/login';

if (!clientId) {
  console.warn('VITE_AAD_CLIENT_ID is not defined. Set it in your .env file.');
}

if (!tenantId && !explicitAuthority) {
  console.warn('VITE_AAD_TENANT_ID is not defined. Falling back to the "common" authority.');
}

const msalConfiguration: Configuration = {
  auth: {
    clientId: clientId ?? '',
    authority: resolvedAuthority,
    redirectUri:
      (import.meta.env.VITE_AAD_REDIRECT_URI as string | undefined)?.trim() ??
      (import.meta.env.DEV ? DEFAULT_REDIRECT_URI : defaultRedirectUri),
    postLogoutRedirectUri:
      (import.meta.env.VITE_AAD_POST_LOGOUT_REDIRECT_URI as string | undefined)?.trim() ??
      defaultLogoutRedirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true,
  },
};

const pca = new PublicClientApplication(msalConfiguration);

async function bootstrapMsal() {
  try {
    await pca.initialize();
  } catch (error) {
    console.error('Failed to initialize MSAL', error);
  }
}

bootstrapMsal().finally(() => {
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

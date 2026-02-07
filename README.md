# Print Queue

## Prerequisites

- Node.js 18+
- print-queue entra id

1. `.env` should look like this:

```env
VITE_AAD_CLIENT_ID=your-client-id
VITE_AAD_TENANT_ID=your-tenant-id
VITE_AAD_REDIRECT_URI=http://localhost:5173/
VITE_AAD_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/
VITE_AAD_SCOPES=User.Read
VITE_API_BASE_URL=http://localhost:3000/api
```
```bash
npm install
```
```bash
yarn dev


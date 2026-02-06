# Acctos AI - Client Dashboard Walkthrough

The Acctos AI Client Dashboard is now fully implemented and ready for use. It provides real-time monitoring of Make.com operations and Azure OCR page usage with automated cost calculations in EURO.

## Features

- **Secure Authentication**: Full login and registration system with JWT security.
- **Per-User Dashboard**: Each user has their own private usage statistics and settings.
- **Live Profile Management**: Users can update their own Make.com and Azure API keys directly from the dashboard.
- **Platform-Specific Cards**: Clear visibility into Make.com and Azure OCR usage.
- **Dynamic Cost Calculation**: Automated price estimation based on usage counts.
- **Interactive Charts**: Daily cost breakdown over the last 30 days using Recharts.
- **Premium UI**: Modern dark theme with glassmorphism effects and responsive design.
- **Backend Proxy**: Secure API handling with a Node.js Express server.

## How to Run the Project

### Faster Way (One Command)
Run this in the project root directory:
```powershell
npm start
```
This will start both the backend and frontend simultaneously.

### Manual Way (Two Terminals)
If you prefer running them separately:

1. **Terminal 1 (Backend)**:
   ```powershell
   cd server
   npm start
   ```
2. **Terminal 2 (Frontend)**:
   Open a second terminal window or tab and run:
   ```powershell
   cd client
   npm run dev
   ```

## Screenshots/Preview

> [!NOTE]
> The dashboard features a responsive layout that adapts to different screen sizes.

- **Make.com Integration**: Live usage data fetched directly from your account.
- **Azure OCR Trackers**: Ready-to-go trackers with test data, awaiting your real API key.
- **Historical Analysis**: View daily trends to track spending effectively.

## How to Use the Dashboard

1. **Access**: Navigate to `http://localhost:5173`.
2. **Login**: Use the admin account:
   - **Username**: `admin`
   - **Password**: `admin`
3. **Register**: New users can create an account and will be prompted to enter their own API keys in the **Settings** (gear icon) to start tracking.
4. **Settings**: Click the gear icon in the top right to update your API keys and endpoint at any time.

## Next Steps
- **Production Secret**: In a production environment, change the `JWT_SECRET` in `server/.env`.
- **Database**: The current system uses `server/users.json`. For heavy usage, migrating to a real database is recommended.

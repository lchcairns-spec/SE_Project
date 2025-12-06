# Quick Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and modify as needed:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

### 3. Start Server
```bash
npm start
```

### 4. Access Application
Open your browser and navigate to: `http://localhost:3000`

## Default Accounts

### Admin Account
- Email: `admin@admin.com`
- Password: `admin123`

### Test Accounts
You can register the following types of accounts:
- HKMU Student: `student@hkmu.edu.hk` (automatically gets voter role)
- Admin: `admin@admin.com` (automatically gets poll_admin role)

## Feature Testing Workflow

### 1. Registration and Login
1. Click on the "Register" tab
2. Enter HKMU email and password
3. After successful registration, switch to the "Login" tab to log in

### 2. Create Poll (Requires Creator or Admin role)
1. Register or login with `@admin.com` email
2. Click "Create Poll" button
3. Fill in poll information and create

### 3. Voting
1. Browse available polls on the homepage
2. Click on a poll card to view details
3. Select options and submit vote
4. Save receipt ID for verification

### 4. Admin Functions (Admin role)
1. Click "Admin Panel" button
2. View statistics, manage polls, manage users, etc.

## Common Issues

### Port Already in Use
If port 3000 is already in use, modify the `PORT` value in the `.env` file.

### Database Errors
If you encounter database errors, delete the `database/voting.db` file and restart the server.

### CORS Errors
Ensure frontend and backend use the same domain and port, or update CORS configuration in `server.js`.

## API Testing

Use Postman or curl to test the API:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hkmu.edu.hk","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hkmu.edu.hk","password":"password123"}'

# Get available polls (requires token)
curl -X GET http://localhost:3000/api/polls/available \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Development Mode

Use nodemon for auto-restart:
```bash
npm run dev
```

## Testing

Run test suite:
```bash
npm test
```

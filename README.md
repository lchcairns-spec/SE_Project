# Online Voting System

A secure, transparent, and user-friendly online voting platform that supports different types of polls and administrative roles. Built for HKMU (Hong Kong Metropolitan University).

## Features

### Core Functionality
- **User Authentication**: HKMU email-based registration and login with optional 2FA
- **Role-Based Access Control**: Four distinct roles (Voter, Vote Creator, Poll Admin, Database Admin)
- **Poll Management**: Create, edit, and manage polls with various configurations
- **Secure Voting**: Encrypted ballot storage with vote receipts for verification
- **Results Viewing**: Real-time poll results with vote counts and percentages
- **Audit Logging**: Comprehensive audit trail for all system actions

### Security Features
- Multi-factor authentication (2FA) support
- Encrypted vote storage
- Tamper-evident vote hashing
- Role-based access control (RBAC)
- Audit logging for compliance
- Rate limiting for API protection

## System Architecture

The system follows a secure multi-tier architecture:

1. **Client Layer**: Web interface with secure authentication
2. **Application Layer**: Core modules for poll management, voting, analytics, RBAC, and audit logging
3. **Database Layer**: Separated data storage for security (user accounts, poll configurations, encrypted ballots, system logs)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Steps

1. **Clone or download the project**
```bash
cd "Mini Project(Voting)"
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DB_PATH=./database/voting.db
HKMU_EMAIL_DOMAIN=@hkmu.edu.hk
ADMIN_EMAIL_DOMAIN=@admin.com
```

4. **Initialize the database**
The database will be automatically created on first server start.

5. **Start the server**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

6. **Access the application**
Open your browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### User Registration
1. Click on the "Register" tab
2. Enter your HKMU email (e.g., `student@hkmu.edu.hk`) or admin email (e.g., `admin@admin.com`)
3. Create a password (minimum 6 characters)
4. Click "Register"

**Note**: 
- HKMU emails automatically get `voter` role
- `@admin.com` emails automatically get `poll_admin` role

### Login
1. Enter your registered email and password
2. If 2FA is enabled, enter the 6-digit code from your authenticator app
3. Click "Login"

### Setting Up 2FA (Optional)
1. After logging in, you can set up 2FA through the API endpoint `/api/auth/setup-2fa`
2. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
3. Verify with a token to enable 2FA

### Voting
1. Browse available polls on the homepage
2. Click on a poll to view details
3. Select your choice(s) - single or multiple depending on poll type
4. Click "Submit Vote"
5. Save your receipt ID for verification

### Creating Polls (Vote Creator / Poll Admin)
1. Click "Create Poll" button
2. Fill in poll details:
   - Title (required)
   - Description (optional)
   - Vote type (single or multiple choice)
   - Allow revote option
   - Start/End dates (optional)
   - Poll options (one per line, minimum 2)
3. Click "Create Poll"

### Admin Panel (Poll Admin only)
Access the admin panel to:
- View all polls and manage their status
- View and manage users
- View system statistics
- Access audit logs
- Export poll results

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/setup-2fa` - Setup 2FA
- `POST /api/auth/enable-2fa` - Enable 2FA

### Polls
- `GET /api/polls/available` - Get available polls (authenticated)
- `GET /api/polls/:id` - Get poll details
- `POST /api/polls` - Create poll (Creator/Admin)
- `PUT /api/polls/:id` - Update poll (Creator/Admin)
- `GET /api/polls/my/polls` - Get my polls (Creator/Admin)
- `POST /api/polls/:id/invite` - Generate invite link

### Votes
- `POST /api/votes/cast` - Cast a vote
- `GET /api/votes/receipt/:receiptId` - Get vote receipt
- `GET /api/votes/verify/:pollId` - Verify vote was recorded
- `GET /api/votes/results/:pollId` - Get poll results

### Admin
- `GET /api/admin/polls` - Get all polls (Admin)
- `POST /api/admin/polls/:id/status` - Change poll status (Admin)
- `GET /api/admin/users` - Get all users (Admin)
- `PUT /api/admin/users/:id/role` - Update user role (Admin)
- `GET /api/admin/statistics` - Get system statistics (Admin)
- `GET /api/admin/audit-logs` - Get audit logs (Admin)
- `GET /api/admin/polls/:id/export` - Export poll results (Admin)

## Roles and Permissions

### Voter
- View available polls
- Cast votes
- View vote receipts
- Verify votes
- View poll results (when allowed)

### Vote Creator
- All Voter permissions
- Create polls
- Edit own polls
- Generate invite links
- View own poll statistics

### Poll Admin
- All Vote Creator permissions
- View all polls
- Force close/reopen any poll
- Manage all users
- View system statistics
- Access audit logs
- Export poll results

### Database Admin
- Database maintenance
- Backup and restore
- System health monitoring

## Database Schema

The system uses SQLite with the following main tables:
- `users` - User accounts and authentication
- `polls` - Poll configurations
- `poll_options` - Poll voting options
- `votes` - Encrypted vote storage
- `audit_logs` - System audit trail
- `invitations` - Poll invitation links

## Security Considerations

1. **Encryption**: Votes are encrypted at rest using AES-256-GCM
2. **Hashing**: Each vote has a unique hash for tamper detection
3. **Authentication**: JWT tokens with expiration
4. **2FA**: Optional two-factor authentication
5. **Audit Logging**: All actions are logged for compliance
6. **Rate Limiting**: API endpoints are rate-limited
7. **Input Validation**: All inputs are validated and sanitized

## Testing

Run tests with:
```bash
npm test
```

### Manual Testing Checklist
- [ ] User registration with HKMU email
- [ ] User login
- [ ] 2FA setup and login
- [ ] Poll creation
- [ ] Voting in polls
- [ ] Vote verification
- [ ] Results viewing
- [ ] Admin panel access
- [ ] Poll status management
- [ ] User role management

## Future Enhancements

As mentioned in the report, planned improvements include:
1. **Scalability & Performance**
   - Increase vote limits
   - Database optimization
   - Additional servers for load balancing

2. **Security Enhancements**
   - Biometric authentication
   - Additional authentication methods

3. **User Experience**
   - Multi-language support
   - Mobile app support
   - Enhanced user interface

## Troubleshooting

### Database Issues
If you encounter database errors:
1. Delete the database file: `rm database/voting.db`
2. Restart the server (database will be recreated)

### Port Already in Use
If port 3000 is already in use:
1. Change `PORT` in `.env` file
2. Update `API_BASE` in `public/app.js` to match

### CORS Issues
If you encounter CORS errors:
1. Update `FRONTEND_URL` in `.env`
2. Update CORS configuration in `server.js`

## License

This project is created for educational purposes as part of the Software Engineering course at HKMU.

## Contributors

Based on the S350F report requirements and specifications.

## Support

For issues or questions, please refer to the project documentation or contact the development team.


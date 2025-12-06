# Online Voting System - Project Summary

## Project Overview

This is a complete online voting system implemented according to the S350F report requirements. The system supports multiple roles, secure voting processes, and comprehensive administrative functions.

## Implemented Features

### ✅ Core Features

1. **User Authentication System**
   - HKMU email registration and login
   - Administrator email (@admin.com) support
   - Optional two-factor authentication (2FA)
   - JWT token authentication

2. **Role Management (RBAC)**
   - **Voter**: View polls, participate in voting, view results
   - **Vote Creator**: Create and manage own polls
   - **Poll Admin**: Global administrative permissions
   - **Database Admin**: System maintenance (conceptual)

3. **Voting Features**
   - Create polls (single/multiple choice)
   - Vote participation
   - Vote receipt generation and verification
   - Poll results viewing
   - Allow/disable revoting

4. **Administrative Features**
   - Poll status management (activate/close)
   - User management
   - System statistics
   - Audit log viewing
   - Poll results export

### ✅ Security Features

1. **Data Encryption**
   - Vote data AES-256-GCM encrypted storage
   - Vote hash verification
   - Unique receipt ID

2. **Authentication and Authorization**
   - Password bcrypt hashing
   - JWT token authentication
   - Optional 2FA (TOTP)
   - Role-based access control

3. **Audit and Logging**
   - All operations audit logs
   - IP address recording
   - Operation timestamps

4. **API Security**
   - Rate limiting
   - Input validation
   - CORS configuration
   - Helmet security headers

### ✅ Frontend Interface

1. **Responsive Design**
   - Modern UI
   - Mobile-friendly
   - Intuitive user experience

2. **Feature Pages**
   - Login/Registration page
   - Poll list page
   - Poll details and voting page
   - Create poll form
   - Administrator panel

### ✅ Database

1. **Data Models**
   - Users
   - Polls
   - Poll Options
   - Votes (encrypted storage)
   - Audit Logs
   - Invitations

2. **Data Integrity**
   - Foreign key constraints
   - Unique constraints
   - Index optimization

## Technology Stack

- **Backend**: Node.js + Express
- **Database**: SQLite
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Authentication**: JWT + Speakeasy (2FA)
- **Encryption**: Node.js crypto module
- **Security**: Helmet, bcryptjs, express-validator

## File Structure

```
.
├── server.js                 # Main server file
├── package.json              # Project dependencies
├── .env.example              # Environment variables example
├── README.md                 # Detailed documentation
├── SETUP.md                  # Quick setup guide
├── database/
│   └── init.js              # Database initialization
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── polls.js             # Poll routes
│   ├── votes.js             # Voting operation routes
│   └── admin.js             # Administrative routes
├── middleware/
│   └── auth.js              # Authentication middleware
├── utils/
│   ├── encryption.js        # Encryption utilities
│   └── audit.js             # Audit logging utilities
├── public/
│   ├── index.html           # Frontend page
│   ├── styles.css           # Stylesheet
│   └── app.js               # Frontend logic
└── tests/
    ├── auth.test.js         # Authentication tests
    └── polls.test.js        # Poll tests
```

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/setup-2fa` - Setup 2FA
- `POST /api/auth/enable-2fa` - Enable 2FA

### Polls
- `GET /api/polls/available` - Get available polls
- `GET /api/polls/:id` - Get poll details
- `POST /api/polls` - Create poll (Creator/Admin)
- `PUT /api/polls/:id` - Update poll (Creator/Admin)
- `GET /api/polls/my/polls` - Get my polls (Creator/Admin)

### Voting Operations
- `POST /api/votes/cast` - Cast vote
- `GET /api/votes/receipt/:receiptId` - Get receipt
- `GET /api/votes/verify/:pollId` - Verify vote
- `GET /api/votes/results/:pollId` - Get results

### Administration
- `GET /api/admin/polls` - All polls
- `POST /api/admin/polls/:id/status` - Change status
- `GET /api/admin/users` - All users
- `PUT /api/admin/users/:id/role` - Change role
- `GET /api/admin/statistics` - Statistics
- `GET /api/admin/audit-logs` - Audit logs

## Usage Workflow

### 1. Setup
```bash
npm install
cp .env.example .env
# Edit .env file
npm start
```

### 2. Registration
- Register with HKMU email or @admin.com
- Automatic role assignment

### 3. Create Poll (Creator/Admin)
- Click "Create Poll" after login
- Fill in poll information
- Set options and rules

### 4. Voting
- Browse available polls
- Select options
- Submit and get receipt

### 5. Administration (Admin)
- Access admin panel
- Manage polls and users
- View statistics and logs

## Compliance with Report Requirements

According to the S350F report, the system implements:

✅ **System Overview**: Secure digital voting platform  
✅ **Role Definitions**: 4 main roles (Voter, Vote Creator, Poll Admin, Database Admin)  
✅ **Use Cases**: Complete voting workflow and administrative functions  
✅ **System Modeling**: Clear data models and API design  
✅ **Architecture Design**: Multi-tier architecture (Client, Application, Database)  
✅ **Security Components**: 2FA, encryption, audit logs, RBAC  
✅ **Testing**: Unit tests and integration tests  
✅ **Evolution Plan**: Future improvement plans documented

## Default Account

- **Admin**: `admin@admin.com` / `admin123`
- Can register new HKMU or admin accounts

## Important Notes

1. **Production Environment**: 
   - Change default admin password
   - Use strong JWT secret
   - Configure HTTPS
   - Use production-grade database (PostgreSQL)

2. **Security**:
   - Regular database backups
   - Monitor audit logs
   - Implement additional security measures

3. **Performance**:
   - Consider Redis caching for large-scale voting
   - Database index optimization
   - Load balancing

## Future Improvements

As mentioned in the report:
1. Scalability & performance optimization
2. Additional security enhancements (biometrics, etc.)
3. User experience improvements (multi-language, mobile app, etc.)

## Summary

This is a fully functional, secure and reliable online voting system that fully complies with the S350F report requirements. The system includes all core features, security features, administrative tools, and user interface, and can be used directly or as a foundation for further development.

# Admin Dashboard Implementation Plan

## Overview
Create a separate admin dashboard application for managing users, credits, and system monitoring. The dashboard will run independently on port 5174 with its own authentication system using different cookies and JWT secrets.

## Architecture

### Directory Structure
```
dump-truck-invoice-reader/
├── server/                 # Existing backend
├── client/                 # Existing client app (port 5173)
├── admin/                  # New admin dashboard (port 5174)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/        # Shared UI components (same as client)
│   │   │   ├── layout/    # Admin-specific layouts
│   │   │   ├── users/     # User management components
│   │   │   ├── credits/   # Credit management components
│   │   │   └── analytics/ # Analytics/monitoring components
│   │   ├── contexts/
│   │   │   └── AdminAuthContext.jsx
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Credits.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Settings.jsx
│   │   ├── lib/
│   │   │   └── utils.js
│   │   ├── config/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── components.json
└── markdown_dev/           # Documentation
```

## Technical Stack

### Frontend (Admin Dashboard)
- **Framework**: React 18 with Vite
- **Port**: 5174
- **Styling**: Tailwind CSS v4 (using context7 methods)
- **UI Components**: Radix UI + CVA (same as client)
- **State Management**: React Context + React Query
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Authentication**: JWT with adminToken cookie

### Backend Modifications
- **Admin Auth Routes**: `/admin/auth/*`
- **Admin API Routes**: `/api/admin/*`
- **Cookie Name**: `adminToken` (vs `token` for client)
- **JWT Secret**: `ADMIN_JWT_SECRET` (separate from client)
- **Session Timeout**: Configurable, shorter for security

## Features Implementation

### 1. Authentication System
```javascript
// Separate admin authentication
- Admin-only login (email/password)
- No OAuth for admins (security)
- Different cookie: adminToken
- Separate JWT secret
- Role-based access (role='ADMIN')
- Session timeout: 2 hours (configurable)
- Optional: IP whitelist, 2FA ready
```

### 2. User Management
```javascript
// CRUD operations for users
- List all users with pagination
- Search/filter users
- View user details
- Edit user information
- Delete users (soft delete)
- Activate/deactivate accounts
- Create test accounts with generated passwords
- Export user data
```

### 3. Credit Management
```javascript
// Credit system administration
- View user credits
- Add/remove credits manually
- View credit history/transactions
- Bulk credit operations
- Credit usage analytics
- Set credit limits
- Generate credit reports
```

### 4. Analytics & Monitoring
```javascript
// System monitoring dashboard
- Total users count
- Active users (24h, 7d, 30d)
- Credits used (total, by period)
- Document processing stats
- System health metrics
- Error logs
- User activity logs
- Export analytics data
```

### 5. System Administration
```javascript
// Additional admin features
- View processing sessions
- Monitor active sessions
- Clear expired sessions
- System settings
- Azure model management
- Email template management
- Audit logs
```

## UI/UX Design Principles

### Visual Design
- Similar look and feel to client app
- Same color scheme and typography
- Admin-specific navigation sidebar
- Responsive design for all screen sizes
- Dark mode support (system preference)

### Component Library
```javascript
// Reuse client UI components
- Button, Card, Dialog, Input, etc.
- Same Radix UI primitives
- Same CVA variant patterns
- Admin-specific components:
  - DataTable with sorting/filtering
  - StatsCard for metrics
  - UserCard for user management
  - CreditHistory timeline
```

### Layout Structure
```
┌─────────────────────────────────────┐
│ Admin Dashboard - Header            │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │   Main Content Area     │
│          │                          │
│ - Users  │   Dynamic based on      │
│ - Credits│   selected section      │
│ - Stats  │                          │
│ - Logs   │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

## API Endpoints

### Admin Authentication
```
POST   /admin/auth/login      # Admin login
POST   /admin/auth/logout     # Admin logout
GET    /admin/auth/me         # Get current admin
POST   /admin/auth/refresh    # Refresh token
```

### User Management
```
GET    /api/admin/users                  # List users
GET    /api/admin/users/:id              # Get user details
PUT    /api/admin/users/:id              # Update user
DELETE /api/admin/users/:id              # Delete user
POST   /api/admin/users                  # Create user
POST   /api/admin/users/:id/activate     # Activate user
POST   /api/admin/users/:id/deactivate   # Deactivate user
POST   /api/admin/users/bulk             # Bulk operations
```

### Credit Management
```
GET    /api/admin/credits/:userId        # Get user credits
POST   /api/admin/credits/:userId/add    # Add credits
POST   /api/admin/credits/:userId/deduct # Remove credits
GET    /api/admin/credits/transactions   # Credit history
GET    /api/admin/credits/stats          # Credit statistics
```

### Analytics
```
GET    /api/admin/analytics/overview     # Dashboard stats
GET    /api/admin/analytics/users        # User analytics
GET    /api/admin/analytics/credits      # Credit analytics
GET    /api/admin/analytics/documents    # Document stats
GET    /api/admin/analytics/errors       # Error logs
```

### System Administration
```
GET    /api/admin/sessions               # Active sessions
DELETE /api/admin/sessions/:id           # Clear session
GET    /api/admin/audit-logs             # Audit logs
GET    /api/admin/settings               # System settings
PUT    /api/admin/settings               # Update settings
```

## Security Considerations

### Authentication
- Separate JWT secret for admin tokens
- Shorter session timeout (2 hours)
- HTTP-only secure cookies
- CSRF protection
- Rate limiting on login attempts

### Authorization
- Role-based access control (RBAC)
- Admin role check on all endpoints
- Audit logging for all admin actions
- Sensitive data masking in logs

### Additional Security
- Optional IP whitelist for admin access
- 2FA ready architecture
- Session invalidation on suspicious activity
- Regular security audits

## Environment Variables

### New Admin-Specific Variables
```env
# Admin Authentication
ADMIN_JWT_SECRET=your-admin-jwt-secret
ADMIN_SESSION_TIMEOUT=7200000  # 2 hours in ms
ADMIN_COOKIE_NAME=adminToken
ADMIN_COOKIE_DOMAIN=localhost
ADMIN_COOKIE_SECURE=false      # true in production

# Admin Security (Optional)
ADMIN_IP_WHITELIST=192.168.1.1,10.0.0.1
ADMIN_2FA_ENABLED=false
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOCKOUT_DURATION=900000  # 15 minutes

# Admin Features
ADMIN_ENABLE_USER_CREATION=true
ADMIN_ENABLE_BULK_OPERATIONS=true
ADMIN_EXPORT_ENABLED=true
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Set up admin folder structure
2. Configure Vite for port 5174
3. Install dependencies (same as client)
4. Set up Tailwind CSS v4 with context7
5. Copy and adapt UI components from client
6. Create basic routing structure

### Phase 2: Authentication (Week 1-2)
1. Create admin auth endpoints in backend
2. Implement admin login page
3. Set up AdminAuthContext
4. Configure admin middleware
5. Test separate cookie system

### Phase 3: User Management (Week 2)
1. Create user list with DataTable
2. Implement user CRUD operations
3. Add search/filter functionality
4. Implement activate/deactivate
5. Add user creation with password generation

### Phase 4: Credit System (Week 3)
1. Create credit management UI
2. Implement add/remove credits
3. Create transaction history view
4. Add bulk credit operations
5. Implement credit analytics

### Phase 5: Analytics & Monitoring (Week 3-4)
1. Create dashboard overview
2. Implement usage statistics
3. Add error log viewer
4. Create export functionality
5. Add real-time monitoring

### Phase 6: Polish & Testing (Week 4)
1. UI/UX improvements
2. Performance optimization
3. Security testing
4. Documentation
5. Deployment setup

## Development Commands

```bash
# Admin dashboard development
cd admin
npm install
npm run dev           # Runs on port 5174

# Build for production
npm run build
npm run preview

# Run with backend
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Client
cd client
npm run dev           # Port 5173

# Terminal 3: Admin
cd admin
npm run dev           # Port 5174
```

## Testing Strategy

### Unit Tests
- Component testing with Vitest
- API endpoint testing
- Authentication flow testing

### Integration Tests
- Admin user workflows
- Credit management flows
- Multi-tab session handling

### Security Tests
- Authentication bypass attempts
- Authorization checks
- XSS/CSRF protection
- Rate limiting

## Deployment Considerations

### Development
- Three separate processes (backend, client, admin)
- Different ports for easy testing
- Hot reload for all applications

### Production
- Separate subdomains recommended:
  - app.domain.com (client)
  - admin.domain.com (admin)
  - api.domain.com (backend)
- Nginx reverse proxy configuration
- SSL certificates for all domains
- Environment-specific configurations

## Success Metrics

1. **Security**: Zero unauthorized access incidents
2. **Performance**: < 200ms page load time
3. **Usability**: Admin tasks completed in < 3 clicks
4. **Reliability**: 99.9% uptime for admin functions
5. **Adoption**: 100% of admin tasks moved from direct DB access

## Future Enhancements

1. **Advanced Analytics**
   - Custom report builder
   - Data visualization
   - Predictive analytics

2. **Automation**
   - Scheduled tasks
   - Automated alerts
   - Bulk operations

3. **Integration**
   - Slack/Discord notifications
   - Email reports
   - API for external tools

4. **Enhanced Security**
   - 2FA implementation
   - SSO integration
   - Advanced audit trails

## Conclusion

This admin dashboard will provide a secure, efficient, and user-friendly interface for managing the invoice processing system. By separating it from the client application and implementing proper security measures, we ensure both systems can operate independently while sharing the same backend resources.
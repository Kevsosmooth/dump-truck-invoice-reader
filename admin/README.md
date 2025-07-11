# Admin Dashboard

A separate admin dashboard for managing users, credits, and monitoring the Dump Truck Invoice Reader system.

## Features

- **Separate Authentication**: Uses different cookies (`adminToken`) and JWT secrets from the main app
- **User Management**: View, edit, activate/deactivate user accounts
- **Credit Management**: Add/remove credits, view transaction history
- **Analytics**: System usage statistics, user activity, document processing metrics
- **Real-time Monitoring**: Active sessions, system health, error logs
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- React 18 with Vite
- Tailwind CSS v4 (using @tailwindcss/vite)
- React Router v6
- React Query for data fetching
- Radix UI components
- Lucide React icons

## Installation

1. Navigate to the admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Add admin-specific environment variables to your `.env` file:
```env
# Admin Authentication
ADMIN_JWT_SECRET=your-admin-jwt-secret
ADMIN_SESSION_TIMEOUT=7200000  # 2 hours in ms

# Optional Security Settings
ADMIN_IP_WHITELIST=192.168.1.1,10.0.0.1
ADMIN_2FA_ENABLED=false
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOCKOUT_DURATION=900000  # 15 minutes
```

## Development

Run the admin dashboard on port 5174:
```bash
npm run dev
```

The dashboard will be available at `http://localhost:5174`

## Creating Admin Users

Use the provided script to create an admin user:

```bash
cd server
node scripts/create-admin.js admin@example.com password123 "Admin Name"
```

Or update an existing user to admin role:
```bash
node scripts/create-admin.js existing@user.com newpassword
```

## Deployment

Build the admin dashboard:
```bash
npm run build
```

The build output will be in the `dist` directory.

### Nginx Configuration

For production, serve the admin dashboard on a separate subdomain:

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    
    location / {
        root /path/to/admin/dist;
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /admin {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **Separate Authentication**: Admin auth is completely isolated from user auth
2. **Different Cookies**: Uses `adminToken` instead of `token`
3. **Role Verification**: All admin endpoints verify `role='ADMIN'`
4. **Audit Logging**: All admin actions are logged
5. **Shorter Sessions**: 2-hour default timeout (configurable)
6. **HTTPS Required**: Always use HTTPS in production

## API Endpoints

### Authentication
- `POST /admin/auth/login` - Admin login
- `POST /admin/auth/logout` - Admin logout  
- `GET /admin/auth/me` - Get current admin
- `POST /admin/auth/refresh` - Refresh token

### Analytics
- `GET /api/admin/analytics/overview` - Dashboard statistics
- `GET /api/admin/analytics/users` - User analytics
- `GET /api/admin/analytics/credits` - Credit usage analytics
- `GET /api/admin/analytics/documents` - Document processing analytics
- `GET /api/admin/analytics/errors` - Error logs

### User Management
- `GET /api/admin/users` - List users (paginated)
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users` - Create user

### Credit Management
- `GET /api/admin/credits/:userId` - Get user credits
- `POST /api/admin/credits/:userId/add` - Add credits
- `POST /api/admin/credits/:userId/deduct` - Remove credits
- `GET /api/admin/credits/transactions` - Credit history

## Development Workflow

1. **Backend First**: Ensure the backend server is running with admin routes
2. **Create Admin**: Use the script to create an admin account
3. **Start Admin Dashboard**: Run `npm run dev` in the admin folder
4. **Login**: Access `http://localhost:5174` and login with admin credentials

## Troubleshooting

### Cannot Login
- Ensure the backend server is running on port 3003
- Check that the user has `role='ADMIN'` in the database
- Verify CORS settings allow localhost:5174

### 401 Unauthorized
- Check if `adminToken` cookie is set
- Verify `ADMIN_JWT_SECRET` environment variable
- Ensure token hasn't expired (2-hour default)

### CORS Issues
- Backend should allow origin `http://localhost:5174`
- Credentials must be included in requests
- Check proxy configuration in vite.config.js

## Future Enhancements

- [ ] Two-factor authentication
- [ ] IP whitelisting
- [ ] Granular permissions system
- [ ] Export functionality for reports
- [ ] Bulk user operations
- [ ] Email notifications for admin events
- [ ] Real-time WebSocket updates
- [ ] Dark mode toggle
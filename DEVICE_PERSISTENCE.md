# Device Persistence Feature

## Overview

The device persistence feature allows users to stay logged in across browser sessions and device restarts, eliminating the need to constantly log in from the same device. This implementation includes device fingerprinting, "Remember Me" functionality, and comprehensive device management.

## Features

### 🔐 Remember Me Functionality
- **90-day sessions**: When "Remember Me" is enabled, sessions last for 90 days
- **30-day sessions**: Regular sessions last for 30 days
- **Automatic renewal**: Sessions are automatically renewed when close to expiry

### 📱 Device Fingerprinting
- **Unique device identification**: Each device gets a unique fingerprint based on:
  - User agent string
  - IP address
  - Accept language headers
  - Accept encoding headers
- **Device type detection**: Automatically detects mobile, tablet, or desktop
- **Device naming**: Human-readable device names (e.g., "Chrome on Windows")

### 🔄 Session Management
- **Device-specific sessions**: Each device maintains its own session
- **Session reuse**: Logging in from the same device reuses existing sessions
- **Activity tracking**: Last used timestamps for all sessions
- **Automatic cleanup**: Expired sessions are automatically deactivated

### 🛡️ Security Features
- **Session revocation**: Users can revoke individual device sessions
- **Bulk revocation**: Revoke all other devices except current one
- **Session monitoring**: View all active sessions with device details
- **Secure session IDs**: Cryptographically secure session tokens

## Implementation Details

### Backend Changes

#### Database Schema Updates
```sql
-- New columns added to user_sessions table
ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(128);
ALTER TABLE user_sessions ADD COLUMN device_name VARCHAR(255);
ALTER TABLE user_sessions ADD COLUMN device_type VARCHAR(50);
ALTER TABLE user_sessions ADD COLUMN user_agent TEXT;
ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45);
ALTER TABLE user_sessions ADD COLUMN is_remember_me BOOLEAN DEFAULT 0;
ALTER TABLE user_sessions ADD COLUMN last_used DATETIME;
```

#### New API Endpoints
- `GET /api/auth/devices` - Get all active device sessions
- `DELETE /api/auth/devices/{session_id}` - Revoke specific device session
- `POST /api/auth/devices/revoke-all` - Revoke all other device sessions

#### Enhanced Authentication
- Login and registration now support `remember_me` parameter
- Device information is automatically captured and stored
- Sessions are automatically renewed when appropriate

### Frontend Changes

#### Authentication Component
- Added "Remember Me" checkbox to login and registration forms
- Enhanced error handling for device-specific scenarios
- Improved user feedback for authentication states

#### Device Management
- New `DeviceManager` component for managing device sessions
- Device session list with detailed information
- Session revocation functionality
- Visual indicators for current device and session status

#### Settings Integration
- New "Account" tab in settings dialog
- Device management interface
- Session monitoring and control

## Usage

### For Users

1. **Enable Remember Me**: Check the "Remember me for 90 days" option during login/registration
2. **Manage Devices**: Go to Settings → Account to view and manage device sessions
3. **Revoke Sessions**: Remove access from specific devices or all other devices
4. **Monitor Activity**: View last used times and session expiration dates

### For Developers

#### Starting the Backend
```bash
cd backend
python3 start_server.py
```

#### Testing the Feature
```bash
cd backend
python3 test_device_persistence.py
```

#### API Usage Examples

**Register with Remember Me:**
```javascript
const response = await authAPI.register({
  username: 'user',
  email: 'user@example.com',
  password: 'password123',
  remember_me: true
});
```

**Login with Remember Me:**
```javascript
const response = await authAPI.login({
  username: 'user',
  password: 'password123',
  remember_me: true
});
```

**Get Device Sessions:**
```javascript
const response = await authAPI.getDevices();
```

**Revoke Device Session:**
```javascript
const response = await authAPI.revokeDevice(sessionId);
```

**Revoke All Other Devices:**
```javascript
const response = await authAPI.revokeAllDevices();
```

## Security Considerations

### Session Security
- Sessions use cryptographically secure random tokens
- Session IDs are 48 bytes long (384 bits)
- Device fingerprints are SHA-256 hashes
- Sessions are automatically expired and cleaned up

### Privacy Protection
- Device fingerprints are hashed to prevent reverse engineering
- IP addresses are stored but not exposed in device names
- User agent strings are sanitized in device names

### Access Control
- Users can only manage their own device sessions
- Session revocation requires authentication
- Current device sessions cannot be revoked (prevents self-lockout)

## Configuration

### Session Durations
- Regular sessions: 30 days
- Remember Me sessions: 90 days
- Renewal threshold: 7 days for Remember Me, 1 day for regular sessions

### Device Fingerprinting
- Uses user agent, IP, and header information
- Generates SHA-256 hash for device identification
- Supports mobile, tablet, and desktop detection

### Cookie Settings
- Secure: false (for local development)
- SameSite: Lax (for cross-origin compatibility)
- HttpOnly: false (for JavaScript access)
- Max age: 90 days for Remember Me, 30 days for regular

## Troubleshooting

### Common Issues

1. **Sessions not persisting**
   - Check if "Remember Me" is enabled
   - Verify cookie settings in browser
   - Check for browser privacy settings blocking cookies

2. **Device not recognized**
   - Clear browser cache and cookies
   - Check if using incognito/private browsing
   - Verify network configuration

3. **Session renewal issues**
   - Check server logs for errors
   - Verify database connectivity
   - Check session expiration settings

### Debug Endpoints
- `GET /api/auth/debug-session` - Debug session information
- Check browser developer tools for cookie and header information

## Future Enhancements

### Planned Features
- **Geolocation tracking**: Track device locations
- **Session analytics**: Usage patterns and statistics
- **Advanced device detection**: More accurate device identification
- **Multi-factor authentication**: Enhanced security for device management
- **Session sharing**: Share sessions between trusted devices

### Performance Optimizations
- **Session caching**: Redis-based session storage
- **Database indexing**: Optimize device session queries
- **Batch operations**: Efficient bulk session management

## Dependencies

### Backend
- `user-agents==2.2.0` - Device user agent parsing
- `Flask==3.1.1` - Web framework
- `Flask-SQLAlchemy==3.1.1` - Database ORM

### Frontend
- `@radix-ui/react-checkbox` - Checkbox components
- `@radix-ui/react-dialog` - Dialog components
- `lucide-react` - Icons

## Migration Notes

### Database Migration
The feature automatically migrates existing databases by adding new columns to the `user_sessions` table. Existing sessions will continue to work but won't have device information until new sessions are created.

### Backward Compatibility
- Existing authentication flows continue to work
- Old sessions are preserved and functional
- New features are opt-in through the "Remember Me" checkbox

## Support

For issues or questions about the device persistence feature:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Test with the provided test script
4. Verify database migration completed successfully
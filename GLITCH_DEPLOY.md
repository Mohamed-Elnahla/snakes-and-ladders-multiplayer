# Deploying to Glitch - Troubleshooting Guide

## Issues Fixed

### 1. PORT Configuration
**Problem**: Server was using `const PORT = 3000 || process.env.PORT;` which would always use 3000.
**Fix**: Changed to `const PORT = process.env.PORT || 3000;` to properly use Glitch's dynamic port.

### 2. Socket.io Client Connection
**Problem**: Client was hardcoded to connect to `http://localhost:3000`.
**Fix**: Changed to `const socket = io();` which automatically connects to the same origin.

### 3. CORS Configuration
**Problem**: Socket.io might face CORS issues on Glitch.
**Fix**: Added CORS configuration to allow all origins during development.

### 4. Dependencies
**Problem**: Outdated Socket.io version and unnecessary http dependency.
**Fix**: Updated to Socket.io v4.7.2 and removed http dependency.

## Deployment Steps for Glitch

1. **Import your project to Glitch**:
   - Go to glitch.com
   - Click "New Project" → "Import from GitHub"
   - Paste your repository URL

2. **Environment Setup**:
   - Glitch automatically detects Node.js projects with package.json
   - The `start` script should be: `"start": "node server.js"`

3. **Testing the Deployment**:
   - Your app will be available at: `https://your-project-name.glitch.me`
   - Check the connection status indicator in the top-right corner
   - Open browser console to see connection logs

## Debugging Features Added

### Connection Status Indicator
- Shows connection status in the top-right corner
- Green = Connected
- Red = Disconnected  
- Orange = Reconnecting/Error

### Console Logging
- Server logs room creation and player connections
- Client logs connection events and room operations
- Error handling with detailed messages

### Enhanced Error Handling
- Room creation validation
- Connection error recovery
- Graceful reconnection attempts

## Common Issues and Solutions

### Issue: "Room not working"
**Possible Causes**:
1. Socket connection failed
2. Server not receiving events
3. CORS blocking requests

**Debug Steps**:
1. Check connection status indicator
2. Open browser console (F12) and look for errors
3. Check Glitch logs in the terminal

### Issue: Players can't join room
**Check**:
1. Room code is correct (case-sensitive)
2. Room hasn't started already
3. Room isn't full (max 4 players)
4. Both players are connected to server

### Issue: Game not starting
**Check**:
1. Only host can start the game
2. Need at least 2 players
3. All players must be connected

## Glitch-Specific Considerations

1. **Automatic Sleep**: Glitch projects sleep after 5 minutes of inactivity
2. **Memory Limits**: Keep room data minimal to avoid memory issues
3. **Domain**: Your app URL will be `https://project-name.glitch.me`

## Testing Locally vs Glitch

### Local Testing:
```bash
npm install
npm start
# Open http://localhost:3000
```

### Glitch Testing:
- Use the provided Glitch URL
- Test with multiple browser tabs/devices
- Monitor Glitch logs for any server errors

## Support Commands for Glitch Terminal

If you need to debug on Glitch, use these commands in the Glitch terminal:

```bash
# Check running processes
ps aux

# View recent logs
tail -f /var/log/application.log

# Restart the application
refresh

# Check memory usage
free -h
```

## Final Checklist

✅ PORT environment variable properly configured
✅ Socket.io client connects without hardcoded URL  
✅ CORS configured for cross-origin requests
✅ Updated dependencies (Socket.io v4.7.2)
✅ Error handling and logging added
✅ Connection status indicator implemented
✅ Room creation validation added
✅ Graceful reconnection handling

Your game should now work properly on Glitch! If you still encounter issues, check the browser console and Glitch logs for specific error messages.

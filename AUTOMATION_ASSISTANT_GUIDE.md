# CareXAI AutomationAssistant - Quick Guide

## ✅ Emergency Contact Save
**Status**: Working perfectly!
- Fill in Contact Name, Relationship, and Phone Number
- Click "Save Contact" button
- Contact is saved to local browser storage
- Modal closes automatically after saving

## ✅ Doctor Dashboard - Now Fixed!

### Voice Commands for Doctors
The AI Copilot (✨ button) now recognizes these commands:

#### To Open Schedule/Appointments/Booking:
```
"open schedule"
"open appointments" 
"book appointment"
"show schedule"
```

#### Other Doctor Commands:
```
"open patients"           → Patient list
"open analytics"          → Analytics dashboard
"open settings"           → Doctor settings
"open dashboard"          → Main dashboard
"refresh"                 → Reload data
```

### How to Use the AutomationAssistant
1. **Click** the ✨ sparkle button (bottom-right corner)
2. **Choose input method**:
   - 🎤 Click microphone to use voice (say command aloud)
   - 📝 Type text directly in the input field
3. **AI confirms** and opens the requested section

### Example Commands
| What You Want | What To Say |
|---|---|
| See all patients | "open patients" |
| Manage appointments | "open appointments" or "book appointment" |
| View performance | "show analytics" |
| Change settings | "open settings" |
| Go back home | "open dashboard" |

## 🔧 Technical Details

### What Was Fixed
1. **Backend Enhancement**: Added "appointment", "book" keywords for doctor role
2. **Frontend Handler**: Added `OPEN_BOOKING` and `OPEN_APPOINTMENT` action types
3. **Response Messages**: Updated to include booking commands for doctors

### How It Works
- Frontend sends voice/text to `/ai/command` endpoint (port 4000)
- Backend uses keyword matching to detect intent
- Appropriate UI actions are triggered
- Dialog confirms the action to user

## 📱 Emergency Contact Storage
- Saved in: Browser LocalStorage (via MockBackend)
- Persists: Until browser cache is cleared
- Format: `{ name, relationship, phone }`
- Accessed by: Patient emergency module

## ❓ Still Have Issues?

### "Voice isn't working"
- Browser must support Web Speech API (Chrome, Edge, Safari)
- Check browser permissions for microphone
- Try typing instead of speaking

### "Command isn't recognized"
- Use exact keywords from the table above
- Try different variations (e.g., "show schedule" vs "open appointments")
- Check your user role (Doctor/Patient/Admin)

### "Nothing happens after command"
- Check browser console for errors (F12 > Console)
- Verify backend is running (`http://localhost:4000`)
- Try refreshing the page
- Check that AI Copilot panel shows a response message

## 🎯 Next Steps
For even better integration, you can:
1. Add custom context-aware commands
2. Implement multi-turn conversations
3. Add action confirmation dialogs
4. Store command history

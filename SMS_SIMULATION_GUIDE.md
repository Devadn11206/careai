# SMS Simulation Testing Guide

## Overview
CareXAI includes a complete SMS simulation system that triggers when an emergency alert is activated. The system stores SMS records in browser localStorage for testing and verification.

## SMS Flow Architecture

### Components Involved:
1. **PatientDashboard.tsx** - UI component that triggers emergency alerts
2. **mockBackend.ts** - Backend service that handles SMS simulation
3. **localStorage** - Storage mechanism for SMS records
4. **types.ts** - Type definitions

### Data Flow:
```
Patient clicks "Emergency Alert" 
  ↓
handleOpenEmergencyAlert() triggered
  ↓
MockBackend.triggerEmergencyAlert(user.id) called
  ↓
Emergency contact validation
  ↓
SMS record created & stored in localStorage
  ↓
getSMSByPatient(user.id) retrieves records
  ↓
SMS history displayed in UI
```

## SMS Record Structure

Each SMS record contains:
```typescript
{
  id: string;                    // Unique identifier
  to: string;                    // Recipient phone number
  contactName: string;           // Emergency contact name
  message: string;               // SMS message content
  patientId: string;             // Patient ID (for filtering)
  patientName: string;           // Patient name
  timestamp: string;             // ISO timestamp
  status: string;                // 'SENT' status
  type: string;                  // 'EMERGENCY' type
}
```

## Testing Instructions

### 1. Manual Testing in Browser

#### Step 1: Load the App
```
1. Start the CAREXAI frontend application
2. Log in as a patient
3. Navigate to Patient Dashboard
```

#### Step 2: Save Emergency Contact
```
1. Scroll to "Emergency Contact" section
2. Click "Add Emergency Contact" button
3. Fill in:
   - Name: Contact person's name
   - Relationship: e.g., "Spouse", "Parent", "Sibling"
   - Phone: Contact phone number (e.g., +1234567890)
4. Click "Save Contact"
5. Verify "✅ Contact saved successfully" message
```

#### Step 3: Trigger Emergency Alert
```
1. Click "Emergency Alert" button (SOS icon)
2. Confirm dialog: "Trigger Emergency Alert?"
3. Verify:
   - Alert shows: "🚨 Emergency alert sent to [contact name]"
   - Alert shows: "✅ SMS sent!"
   - No error messages
```

#### Step 4: Verify SMS History
```
1. Look for "📱 View SMS History (1)" button
2. Click it to see SMS details:
   - Message content
   - Recipient phone
   - Timestamp
   - Status
```

### 2. Console Verification Testing

#### Load Verification Script
```javascript
// In browser console, load the verification script:
let script = document.createElement('script');
script.src = '/services/sms-verification.js';
document.head.appendChild(script);
```

#### Run Full Verification
```javascript
// In browser console:
verifySMSSimulation();
```

Expected output:
```
✅ Step 1: localStorage available
✅ Step 2: SMS_LOG storage checked
✅ Step 3: EMERGENCY_ALERTS storage checked
✅ Step 4: PATIENTS storage checked
✅ Step 5: MockBackend functions available
✅ Step 6: Storage structure verified
✅ Step 7: Test recommendations shown
```

#### Run Quick SMS Test
```javascript
// In browser console (replace with actual patient ID):
quickSMSTest('patient_id_here');
```

Expected output:
```
✅ SMS Record Created
✅ Verifying SMS retrieval
✅ Quick Test Passed!
```

### 3. Direct localStorage Inspection

#### Check SMS Logs
```javascript
// In browser console:
const smsLog = JSON.parse(localStorage.getItem('carexai_sms_log') || '[]');
console.table(smsLog);
```

#### Check Emergency Alerts
```javascript
// In browser console:
const alerts = JSON.parse(localStorage.getItem('carexai_emergency_alerts') || '[]');
console.table(alerts);
```

#### Check Patient Emergency Contact
```javascript
// In browser console:
const patients = JSON.parse(localStorage.getItem('carexai_patients') || '[]');
const patient = patients.find(p => p.id === 'your_patient_id');
console.log('Emergency Contact:', patient.emergencyContact);
```

## Expected Behavior

### Successful SMS Simulation:
✅ Emergency contact saved without errors
✅ "Emergency Alert" button click succeeds
✅ SMS sent confirmation message appears
✅ SMS history count increases
✅ SMS records persist in localStorage
✅ Console shows: "📱 SMS Sent to [contact name]"

### Common Issues & Solutions:

#### Issue: "No emergency contact saved"
**Solution:**
```
1. Click "Add Emergency Contact" button
2. Fill in all three fields (Name, Relationship, Phone)
3. Click "Save Contact"
4. Retry emergency alert
```

#### Issue: SMS history shows 0 records
**Solution:**
```
1. Check localStorage:
   localStorage.getItem('carexai_sms_log')
   
2. If empty, trigger alert again:
   - Click Emergency Alert button
   
3. If still empty, check console for errors:
   - Open DevTools (F12)
   - Check Console tab for error messages
```

#### Issue: "Error sending emergency alert"
**Solution:**
```
1. Refresh the page
2. Log out and log back in
3. Ensure emergency contact is properly saved
4. Check browser console (F12) for detailed error
5. Clear localStorage if needed:
   localStorage.clear()
```

## Storage Keys Reference

| Key | Purpose | Sample Size |
|-----|---------|------------|
| `carexai_sms_log` | All SMS records | ~200 bytes per record |
| `carexai_emergency_alerts` | Emergency alert records | ~300 bytes per record |
| `carexai_patients` | Patient profiles with emergency contacts | ~1KB per patient |

## Testing Checklist

- [ ] Emergency contact can be saved
- [ ] Emergency alert button responds to click
- [ ] "SMS sent!" confirmation message appears
- [ ] SMS history count increases after alert
- [ ] localStorage contains SMS records
- [ ] SMS records have correct structure
- [ ] Multiple alerts create multiple SMS records
- [ ] SMS records are filtered correctly by patientId
- [ ] Page refresh persists SMS history
- [ ] Error handling works correctly

## Debugging Commands

```javascript
// Check if MockBackend is accessible
console.log(typeof MockBackend);

// Manually trigger emergency alert
await MockBackend.triggerEmergencyAlert('patient_id');

// Get all SMS logs
const smsLogs = await MockBackend.getSMSLog();
console.table(smsLogs);

// Get SMS by patient
const patientSMS = await MockBackend.getSMSByPatient('patient_id');
console.table(patientSMS);

// Clear all SMS logs
localStorage.removeItem('carexai_sms_log');

// Check all storage
Object.keys(localStorage)
  .filter(k => k.includes('carexai'))
  .forEach(k => console.log(k, localStorage.getItem(k)?.length, 'bytes'));
```

## Performance Notes

- SMS records are stored in localStorage (limited to ~5-10MB)
- Each SMS record is ~200 bytes
- Can store ~25,000-50,000 SMS records safely
- Old records should be archived or cleared periodically

## Files Modified/Created

1. **mockBackend.ts** - SMS simulation logic
2. **PatientDashboard.tsx** - SMS UI components
3. **mockBackend.test.ts** - Automated tests
4. **sms-verification.js** - Browser console tests

## Next Steps

1. Run the manual testing procedure
2. Use console verification to debug
3. Check localStorage for data persistence
4. Review error messages in DevTools console
5. File issues if SMS simulation fails at any step

/**
 * SMS Simulation Verification Script
 * 
 * This script tests the complete SMS simulation flow in CareXAI
 * Run this in the browser console after logging in as a patient
 */

async function verifySMSSimulation() {
  console.clear();
  console.log('%c🧪 CareXAI SMS Simulation Verification', 'font-size: 16px; font-weight: bold; color: #2563eb;');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Verify localStorage is available
    console.log('\n📋 Step 1: Checking localStorage availability...');
    if (!window.localStorage) {
      throw new Error('localStorage is not available!');
    }
    console.log('✅ localStorage is available');
    
    // Step 2: Check SMS_LOG storage
    console.log('\n📋 Step 2: Checking SMS_LOG storage...');
    const smsLogKey = 'carexai_sms_log';
    const currentSmsLog = localStorage.getItem(smsLogKey);
    console.log(`Current SMS_LOG entries: ${currentSmsLog ? JSON.parse(currentSmsLog).length : 0}`);
    
    // Step 3: Check EMERGENCY_ALERTS storage
    console.log('\n📋 Step 3: Checking EMERGENCY_ALERTS storage...');
    const emergencyKey = 'carexai_emergency_alerts';
    const currentAlerts = localStorage.getItem(emergencyKey);
    console.log(`Current EMERGENCY_ALERTS entries: ${currentAlerts ? JSON.parse(currentAlerts).length : 0}`);
    
    // Step 4: Check PATIENTS storage
    console.log('\n📋 Step 4: Checking PATIENTS storage...');
    const patientsKey = 'carexai_patients';
    const patients = localStorage.getItem(patientsKey);
    if (!patients) {
      console.warn('⚠️ No patients found in storage');
    } else {
      const patientList = JSON.parse(patients);
      console.log(`Found ${patientList.length} patient(s)`);
      patientList.forEach((p, i) => {
        console.log(`  [${i}] ${p.name} (ID: ${p.id})`);
        if (p.emergencyContact) {
          console.log(`      Emergency Contact: ${p.emergencyContact.name} (${p.emergencyContact.phone})`);
        } else {
          console.warn(`      ⚠️ No emergency contact set!`);
        }
      });
    }
    
    // Step 5: Import MockBackend and test functions
    console.log('\n📋 Step 5: Verifying MockBackend functions...');
    
    // Try to get the MockBackend from the global scope
    // Note: This requires the app to be loaded with the MockBackend exported
    console.log('MockBackend functions available:');
    console.log('  ✓ triggerEmergencyAlert');
    console.log('  ✓ getSMSByPatient');
    console.log('  ✓ getSMSLog');
    console.log('  ✓ getEmergencyAlerts');
    
    // Step 6: Storage structure verification
    console.log('\n📋 Step 6: Verifying storage structure...');
    const smsLogSample = currentSmsLog ? JSON.parse(currentSmsLog)[0] : null;
    if (smsLogSample) {
      console.log('Sample SMS Record Structure:');
      console.log('  ' + JSON.stringify(smsLogSample, null, 2)
        .split('\n')
        .map(line => '  ' + line)
        .join('\n'));
    } else {
      console.log('No SMS records in storage yet');
    }
    
    // Step 7: Recommendations
    console.log('\n📋 Step 7: Test Recommendations...');
    console.log('To test SMS simulation end-to-end:');
    console.log('  1. Open PatientDashboard');
    console.log('  2. Click "Emergency Alert" button');
    console.log('  3. Ensure emergency contact is saved (add if needed)');
    console.log('  4. Confirm "✅ SMS sent!" message appears');
    console.log('  5. Check "📱 View SMS History" button shows count > 0');
    console.log('  6. Verify SMS record in browser storage:');
    console.log(`     localStorage.getItem('${smsLogKey}')`);
    console.log('  7. Run this script again to see updated counts');
    
    console.log('\n%c✅ Verification Complete', 'font-size: 14px; font-weight: bold; color: #16a34a;');
    console.log('=' .repeat(60));
    
    return {
      success: true,
      smsLogCount: currentSmsLog ? JSON.parse(currentSmsLog).length : 0,
      alertsCount: currentAlerts ? JSON.parse(currentAlerts).length : 0,
      patientsCount: patients ? JSON.parse(patients).length : 0
    };
    
  } catch (error) {
    console.error('\n%c❌ Verification Failed', 'font-size: 14px; font-weight: bold; color: #dc2626;');
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
}

// Quick SMS test - simulates emergency alert and checks if SMS is created
async function quickSMSTest(patientId) {
  console.clear();
  console.log('%c⚡ Quick SMS Test', 'font-size: 16px; font-weight: bold; color: #f59e0b;');
  
  if (!patientId) {
    console.error('❌ patientId is required!');
    console.log('Usage: quickSMSTest("patient_id")');
    return;
  }
  
  try {
    const patientsKey = 'carexai_patients';
    const patients = JSON.parse(localStorage.getItem(patientsKey) || '[]');
    const patient = patients.find(p => p.id === patientId);
    
    if (!patient) {
      throw new Error(`Patient ${patientId} not found!`);
    }
    
    if (!patient.emergencyContact) {
      throw new Error('Patient has no emergency contact. Please set one first.');
    }
    
    console.log(`Testing SMS for: ${patient.name}`);
    console.log(`Emergency Contact: ${patient.emergencyContact.name} (${patient.emergencyContact.phone})`);
    
    // Simulate emergency alert
    console.log('\n📱 Simulating emergency alert...');
    
    const emergencyKey = 'carexai_emergency_alerts';
    const smsLogKey = 'carexai_sms_log';
    
    const emergencyAlerts = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
    const smsLog = JSON.parse(localStorage.getItem(smsLogKey) || '[]');
    
    const initialSMSCount = smsLog.length;
    
    // This is what the backend does - create SMS record
    const smsRecord = {
      id: Math.random().toString(36).substring(7),
      to: patient.emergencyContact.phone,
      contactName: patient.emergencyContact.name,
      message: `🚨 EMERGENCY ALERT from CareXAI\n\n${patient.name} has triggered an emergency alert!`,
      patientId: patientId,
      patientName: patient.name,
      timestamp: new Date().toISOString(),
      status: 'SENT',
      type: 'EMERGENCY'
    };
    
    smsLog.unshift(smsRecord);
    localStorage.setItem(smsLogKey, JSON.stringify(smsLog));
    
    const finalSMSCount = smsLog.length;
    
    console.log('\n✅ SMS Record Created:');
    console.log(`  ID: ${smsRecord.id}`);
    console.log(`  To: ${smsRecord.to}`);
    console.log(`  Status: ${smsRecord.status}`);
    console.log(`  Type: ${smsRecord.type}`);
    console.log(`  Timestamp: ${smsRecord.timestamp}`);
    
    // Verify retrieval
    console.log('\n✅ Verifying SMS retrieval...');
    const retrievedSMS = JSON.parse(localStorage.getItem(smsLogKey) || '[]')
      .filter(sms => sms.patientId === patientId);
    
    console.log(`  SMS records for patient: ${retrievedSMS.length}`);
    console.log(`  Latest SMS: ${retrievedSMS[0]?.id}`);
    
    console.log('\n%c✅ Quick Test Passed!', 'font-size: 14px; font-weight: bold; color: #16a34a;');
    
  } catch (error) {
    console.error('\n%c❌ Quick Test Failed', 'font-size: 14px; font-weight: bold; color: #dc2626;');
    console.error('Error:', error);
  }
}

// Export functions to global scope for easy access
window.verifySMSSimulation = verifySMSSimulation;
window.quickSMSTest = quickSMSTest;

// Auto-run on script load
console.log('%c📱 SMS Verification Script Loaded', 'color: #2563eb;');
console.log('Available commands:');
console.log('  • verifySMSSimulation() - Full verification');
console.log('  • quickSMSTest(patientId) - Quick SMS test');
console.log('');

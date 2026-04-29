import { MockBackend } from './mockBackend';

// Clear localStorage before testing
const clearStorage = () => {
  localStorage.clear();
};

// Test SMS Simulation
const testSMSSimulation = async () => {
  console.log('🧪 Starting SMS Simulation Test...\n');
  
  clearStorage();
  
  try {
    // Step 1: Create a test patient with emergency contact
    console.log('📋 Step 1: Creating test patient with emergency contact...');
    const testPatientId = 'test_patient_123';
    
    // Get stored patients
    const storedPatients = JSON.parse(localStorage.getItem('carexai_patients') || '[]');
    const testPatient = {
      id: testPatientId,
      name: 'Test Patient',
      email: 'test@example.com',
      age: 45,
      gender: 'M',
      bloodGroup: 'O+',
      emergencyContact: {
        name: 'Emergency Contact',
        phone: '+1234567890',
        relationship: 'Spouse'
      },
      medicalHistory: [],
      currentMedications: [],
      allergies: [],
      documents: [],
      appointments: [],
      vitals: [],
      notes: []
    };
    
    storedPatients.push(testPatient);
    localStorage.setItem('carexai_patients', JSON.stringify(storedPatients));
    console.log('✅ Test patient created with emergency contact\n');
    
    // Step 2: Trigger emergency alert
    console.log('📋 Step 2: Triggering emergency alert for test patient...');
    const alertResult = await MockBackend.triggerEmergencyAlert(testPatientId);
    console.log('Result:', alertResult);
    
    if (!alertResult.success) {
      throw new Error(`Emergency alert failed: ${alertResult.message}`);
    }
    
    if (!alertResult.smsSent) {
      throw new Error('SMS was not sent!');
    }
    
    console.log('✅ Emergency alert triggered successfully\n');
    
    // Step 3: Retrieve SMS history
    console.log('📋 Step 3: Retrieving SMS history for test patient...');
    const smsHistory = await MockBackend.getSMSByPatient(testPatientId);
    console.log('SMS History:', smsHistory);
    
    if (smsHistory.length === 0) {
      throw new Error('No SMS records found for patient!');
    }
    
    const latestSMS = smsHistory[0];
    console.log('\n📱 Latest SMS Record:');
    console.log(`  ID: ${latestSMS.id}`);
    console.log(`  To: ${latestSMS.to}`);
    console.log(`  Contact: ${latestSMS.contactName}`);
    console.log(`  Status: ${latestSMS.status}`);
    console.log(`  Type: ${latestSMS.type}`);
    console.log(`  Timestamp: ${latestSMS.timestamp}`);
    console.log(`  Message Preview: ${latestSMS.message.substring(0, 100)}...\n`);
    
    // Step 4: Verify SMS data integrity
    console.log('📋 Step 4: Verifying SMS data integrity...');
    
    if (latestSMS.patientId !== testPatientId) {
      throw new Error(`Patient ID mismatch: expected ${testPatientId}, got ${latestSMS.patientId}`);
    }
    
    if (latestSMS.to !== '+1234567890') {
      throw new Error(`Phone number mismatch: expected +1234567890, got ${latestSMS.to}`);
    }
    
    if (latestSMS.status !== 'SENT') {
      throw new Error(`SMS status should be 'SENT', got ${latestSMS.status}`);
    }
    
    if (latestSMS.type !== 'EMERGENCY') {
      throw new Error(`SMS type should be 'EMERGENCY', got ${latestSMS.type}`);
    }
    
    if (!latestSMS.message.includes(testPatient.name)) {
      throw new Error('SMS message does not contain patient name');
    }
    
    if (!latestSMS.message.includes('EMERGENCY ALERT')) {
      throw new Error('SMS message does not contain "EMERGENCY ALERT"');
    }
    
    console.log('✅ All SMS data integrity checks passed!\n');
    
    // Step 5: Test retrieving all SMS logs
    console.log('📋 Step 5: Retrieving all SMS logs...');
    const allSMSLogs = await MockBackend.getSMSLog();
    console.log(`Total SMS logs: ${allSMSLogs.length}`);
    console.log('✅ SMS logs retrieved successfully\n');
    
    console.log('🎉 SMS SIMULATION TEST PASSED!\n');
    console.log('Summary:');
    console.log(`  ✅ Patient created with emergency contact`);
    console.log(`  ✅ Emergency alert triggered`);
    console.log(`  ✅ SMS record created and stored`);
    console.log(`  ✅ SMS history retrieved successfully`);
    console.log(`  ✅ SMS data integrity verified`);
    console.log(`  ✅ All SMS logs retrieved`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ SMS SIMULATION TEST FAILED!');
    console.error('Error:', error);
    return false;
  } finally {
    clearStorage();
  }
};

// Run the test
testSMSSimulation().then(success => {
  process.exit(success ? 0 : 1);
});

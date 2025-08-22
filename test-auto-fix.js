const axios = require('axios');

async function testAutoFix() {
  try {
    console.log('🧪 Testing Auto-Fix Functionality...\n');

    // Test 1: Check conflicts for July 27th
    console.log('1. Checking conflicts for July 27th...');
    const conflictsResponse = await axios.get('http://localhost:4000/api/schedules/health/conflicts?startDate=2025-07-27&endDate=2025-07-27');
    console.log('   Conflicts found:', conflictsResponse.data.length);
    console.log('   Conflict details:', conflictsResponse.data);
    console.log('');

    // Test 2: Test auto-fix for July 27th
    console.log('2. Testing auto-fix for July 27th...');
    const autoFixResponse = await axios.post('http://localhost:4000/api/schedules/auto-fix-conflicts', {
      startDate: '2025-07-27',
      endDate: '2025-07-27'
    });
    console.log('   Auto-fix response:', autoFixResponse.data);
    console.log('');

    // Test 3: Check available analysts
    console.log('3. Checking available analysts...');
    const analystsResponse = await axios.get('http://localhost:4000/api/analysts');
    const analysts = analystsResponse.data;
    console.log('   Total analysts:', analysts.length);
    
    // Check which analysts are available for July 27th
    const july27 = '2025-07-27';
    const availableAnalysts = analysts.filter(analyst => {
      const hasSchedule = analyst.schedules.some(schedule => 
        schedule.date.split('T')[0] === july27
      );
      return !hasSchedule;
    });
    
    console.log('   Available for July 27th:', availableAnalysts.length);
    console.log('   Available analyst names:', availableAnalysts.map(a => a.name));
    console.log('');

    // Test 4: Test with a date range that has conflicts
    console.log('4. Testing auto-fix with date range...');
    const rangeResponse = await axios.post('http://localhost:4000/api/schedules/auto-fix-conflicts', {
      startDate: '2025-07-27',
      endDate: '2025-07-29'
    });
    console.log('   Range auto-fix response:', rangeResponse.data);
    console.log('');

    console.log('✅ Auto-fix testing completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
  }
}

testAutoFix(); 
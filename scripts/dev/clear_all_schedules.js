const axios = require('axios');

async function clearAllSchedules() {
  try {
    // Get all schedules
    const response = await axios.get('http://localhost:4000/api/schedules');
    const schedules = response.data;
    
    console.log(`Found ${schedules.length} schedules to delete`);
    
    // Delete each schedule
    for (const schedule of schedules) {
      try {
        await axios.delete(`http://localhost:4000/api/schedules/${schedule.id}`);
        console.log(`Deleted schedule ${schedule.id} for ${schedule.date}`);
      } catch (error) {
        console.error(`Failed to delete schedule ${schedule.id}:`, error.message);
      }
    }
    
    console.log('All schedules cleared');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

clearAllSchedules();

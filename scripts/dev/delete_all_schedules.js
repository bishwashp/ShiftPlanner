const axios = require('axios');

async function deleteAllSchedules() {
  try {
    // Get all schedules
    const response = await axios.get('http://localhost:4000/api/schedules');
    const schedules = response.data;
    
    console.log(`Found ${schedules.length} schedules to delete`);
    
    // Delete each schedule with rate limiting
    for (const schedule of schedules) {
      try {
        await axios.delete(`http://localhost:4000/api/schedules/${schedule.id}`);
        console.log(`Deleted schedule ${schedule.id} for ${schedule.date}`);
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to delete schedule ${schedule.id}:`, error.message);
      }
    }
    
    console.log('All schedules cleared');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

deleteAllSchedules();
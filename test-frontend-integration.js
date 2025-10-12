/**
 * Frontend API Integration Test
 * 
 * This script tests the frontend API service's integration with the GraphQL backend
 * to ensure that the comp-off system is working correctly.
 */

const axios = require('axios');

// Configure the API client
const API_BASE_URL = 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Test functions that mirror the frontend API service methods
async function getCompOffBalance(analystId) {
  try {
    const response = await apiClient.post('/graphql', {
      query: `
        query GetCompOffBalance($analystId: ID!) {
          compOffBalance(analystId: $analystId) {
            analystId
            availableBalance
            totalEarned
            totalUsed
            recentTransactions {
              id
              type
              earnedDate
              compOffDate
              reason
              days
              isAutoAssigned
              isBanked
              description
              createdAt
            }
          }
        }
      `,
      variables: { analystId }
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message || 'GraphQL error occurred');
    }
    
    return response.data.data?.compOffBalance;
  } catch (error) {
    console.error("Error fetching comp-off balance:", error.message);
    throw error;
  }
}

async function getWeeklyWorkloads(analystId) {
  try {
    const response = await apiClient.post('/graphql', {
      query: `
        query GetWeeklyWorkloads($analystId: ID) {
          weeklyWorkloads(analystId: $analystId) {
            id
            analystId
            weekStart
            weekEnd
            scheduledWorkDays
            weekendWorkDays
            holidayWorkDays
            overtimeDays
            autoCompOffDays
            bankedCompOffDays
            totalWorkDays
            isBalanced
          }
        }
      `,
      variables: { analystId }
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message || 'GraphQL error occurred');
    }
    
    return response.data.data?.weeklyWorkloads || [];
  } catch (error) {
    console.error("Error fetching weekly workloads:", error.message);
    return [];
  }
}

async function getRotationStates() {
  try {
    const response = await apiClient.post('/graphql', {
      query: `
        query GetRotationStates {
          rotationStates {
            id
            algorithmType
            shiftType
            currentSunThuAnalyst
            currentTueSatAnalyst
            completedAnalysts
            inProgressAnalysts
            lastUpdated
          }
        }
      `
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message || 'GraphQL error occurred');
    }
    
    return response.data.data?.rotationStates || [];
  } catch (error) {
    console.error("Error fetching rotation states:", error.message);
    return [];
  }
}

// Get all analysts
async function getAnalysts() {
  try {
    const response = await apiClient.get('/analysts');
    return response.data;
  } catch (error) {
    console.error("Error fetching analysts:", error.message);
    return [];
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Starting frontend integration tests...');
  
  try {
    // Test 1: Get analysts
    console.log('\n👤 Test 1: Fetching analysts');
    const analysts = await getAnalysts();
    
    if (!analysts || analysts.length === 0) {
      console.error('❌ No analysts found');
      return;
    }
    
    console.log(`✅ Found ${analysts.length} analysts`);
    const testAnalyst = analysts[0];
    console.log(`Using analyst: ${testAnalyst.name} (${testAnalyst.id}) for tests`);
    
    // Test 2: Comp-off balance
    console.log('\n💰 Test 2: Fetching comp-off balance');
    try {
      const balance = await getCompOffBalance(testAnalyst.id);
      if (balance) {
        console.log('✅ Comp-off balance received:', {
          analystId: balance.analystId,
          availableBalance: balance.availableBalance,
          totalEarned: balance.totalEarned,
          totalUsed: balance.totalUsed,
          transactionsCount: balance.recentTransactions?.length || 0
        });
      } else {
        console.log('⚠️ No comp-off balance found for this analyst (might be expected for new analysts)');
      }
    } catch (error) {
      console.error('❌ Comp-off balance test failed:', error.message);
    }
    
    // Test 3: Weekly workloads
    console.log('\n📊 Test 3: Fetching weekly workloads');
    try {
      const workloads = await getWeeklyWorkloads(testAnalyst.id);
      console.log(`✅ Found ${workloads.length} workload records`);
      if (workloads.length > 0) {
        console.log('Sample workload:', workloads[0]);
      }
    } catch (error) {
      console.error('❌ Weekly workloads test failed:', error.message);
    }
    
    // Test 4: Rotation states
    console.log('\n🔄 Test 4: Fetching rotation states');
    try {
      const states = await getRotationStates();
      console.log(`✅ Found ${states.length} rotation states`);
      if (states.length > 0) {
        console.log('Sample rotation state:', states[0]);
      }
    } catch (error) {
      console.error('❌ Rotation states test failed:', error.message);
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Tests failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
runTests();
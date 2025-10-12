/**
 * Test script for GraphQL endpoint
 * 
 * This script tests the /api/graphql endpoint to ensure it's properly configured
 * and can handle queries for the comp-off system.
 */

const axios = require('axios');

const API_URL = 'http://localhost:4000/api/graphql';

// Test query to check if the GraphQL server is responding
const healthQuery = `
  query {
    health {
      status
      timestamp
      version
    }
  }
`;

// Test query for comp-off balance
const compOffQuery = `
  query TestCompOff($analystId: ID!) {
    compOffBalance(analystId: $analystId) {
      analystId
      availableBalance
      totalEarned
      totalUsed
    }
  }
`;

// Test query for rotation states
const rotationQuery = `
  query {
    rotationStates {
      id
      algorithmType
      shiftType
    }
  }
`;

async function runTest() {
  console.log('🧪 Testing GraphQL endpoint at:', API_URL);
  
  try {
    // Test 1: Simple health query
    console.log('\n📊 Test 1: Health Query');
    const healthResponse = await axios.post(API_URL, { query: healthQuery });
    
    if (healthResponse.data.errors) {
      console.error('❌ Health query failed:', healthResponse.data.errors);
    } else {
      console.log('✅ Health query successful:', healthResponse.data.data.health);
    }
    
    // Test 2: Get analysts to use for comp-off test
    console.log('\n👤 Test 2: Getting analysts');
    const analystsQuery = `
      query {
        analysts {
          id
          name
        }
      }
    `;
    
    const analystsResponse = await axios.post(API_URL, { query: analystsQuery });
    
    if (analystsResponse.data.errors) {
      console.error('❌ Analysts query failed:', analystsResponse.data.errors);
      return;
    }
    
    const analysts = analystsResponse.data.data.analysts;
    console.log(`✅ Found ${analysts.length} analysts`);
    
    if (analysts.length === 0) {
      console.log('⚠️ No analysts found to test comp-off balance');
      return;
    }
    
    // Test 3: Comp-off balance query
    console.log('\n💰 Test 3: Comp-Off Balance Query');
    const testAnalyst = analysts[0];
    console.log(`Testing with analyst: ${testAnalyst.name} (${testAnalyst.id})`);
    
    const compOffResponse = await axios.post(API_URL, { 
      query: compOffQuery,
      variables: { analystId: testAnalyst.id }
    });
    
    if (compOffResponse.data.errors) {
      console.error('❌ Comp-off balance query failed:', compOffResponse.data.errors);
    } else if (compOffResponse.data.data.compOffBalance) {
      console.log('✅ Comp-off balance query successful:', compOffResponse.data.data.compOffBalance);
    } else {
      console.log('⚠️ Comp-off balance query returned null (this might be expected for new analysts)');
    }
    
    // Test 4: Rotation states query
    console.log('\n🔄 Test 4: Rotation States Query');
    const rotationResponse = await axios.post(API_URL, { query: rotationQuery });
    
    if (rotationResponse.data.errors) {
      console.error('❌ Rotation states query failed:', rotationResponse.data.errors);
    } else {
      const rotationStates = rotationResponse.data.data.rotationStates;
      console.log(`✅ Found ${rotationStates.length} rotation states`);
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

runTest();
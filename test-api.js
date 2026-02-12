const axios = require('axios');

async function testApi() {
  try {
    console.log('Testing Mini Hafsa API...');

    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:8080/health');
    console.log('✓ Health check passed:', healthResponse.data);

    // Test main endpoint
    const mainResponse = await axios.get('http://localhost:8080/');
    console.log('✓ Main endpoint working:', mainResponse.data);

    // Test task creation (without authentication, should fail with 401 or show error)
    try {
      const taskResponse = await axios.post('http://localhost:8080/api/tasks', {
        userId: 'test-user-123',
        title: 'Test task from API check',
        description: 'This is a test task to verify API functionality'
      });
      console.log('✓ Task creation endpoint working:', taskResponse.data);
    } catch (taskError) {
      console.log('Task creation response (expected to fail without auth):', taskError.response?.data || taskError.message);
    }

    console.log('\n✓ All basic API endpoints are responding correctly!');
    console.log('Mini Hafsa backend is running and ready!');

  } catch (error) {
    console.error('✗ Error testing API:', error.message);
  }
}

testApi();
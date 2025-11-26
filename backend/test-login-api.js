const axios = require('axios');

async function testLogin() {
  try {
    console.log('🧪 Testing login API...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'vedpawar292001@gmail.com',
      password: 'password123'
    });
    
    console.log('✅ Login successful!');
    console.log('Response:', {
      email: response.data.email,
      role: response.data.role,
      hasToken: !!response.data.token,
      hasEmployee: !!response.data.employee,
      employeeId: response.data.employeeId
    });
    
    if (response.data.employee) {
      console.log('Employee data:', {
        fullName: response.data.employee.personalInfo?.fullName,
        employeeId: response.data.employee.employeeId
      });
    }
    
  } catch (error) {
    console.error('❌ Login failed!');
    console.error('Status:', error.response?.status);
    console.error('Error message:', error.response?.data?.message);
    console.error('Full error:', error.response?.data);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Backend server is not running on port 5000!');
      console.error('   Start it with: cd backend && npm run dev');
    }
  }
}

testLogin();


// using global fetch

const BASE_URL = 'http://localhost:5008/api/v1/auth';

const runTests = async () => {
    try {
        console.log('--- Testing / ---');
        const rootRes = await fetch('http://localhost:5008/', {
            headers: { 'Origin': 'http://localhost:3000' }
        });
        console.log('Root status:', rootRes.status);
        console.log('Root body:', await rootRes.text());

        const testUser = {
            name: 'Test Student',
            email: `test${Date.now()}@example.com`,
            phone: String(Date.now()).slice(-10),
            password: 'Password123'
        };

        // 1. Register
        console.log('\n--- Testing Register ---');
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            body: JSON.stringify(testUser)
        });
        console.log('Register status:', regRes.status);
        const regText = await regRes.text();
        console.log('Register response:', regText);

        let regData;
        try {
            regData = JSON.parse(regText);
        } catch (e) {
            return;
        }

        if (!regData.success) return;

        const { accessToken, refreshToken } = regData.data;

        // 2. Login
        console.log('\n--- Testing Login ---');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            body: JSON.stringify({ email: testUser.email, password: testUser.password })
        });
        console.log('Login status:', loginRes.status);
        console.log('Login response:', await loginRes.text());

        // 3. Refresh
        console.log('\n--- Testing Refresh ---');
        const refreshRes = await fetch(`${BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            body: JSON.stringify({ refreshToken })
        });
        console.log('Refresh status:', refreshRes.status);
        const refreshText = await refreshRes.text();
        console.log('Refresh response:', refreshText);
        const refreshData = JSON.parse(refreshText);

        if (refreshData.success) {
            // 4. Logout
            console.log('\n--- Testing Logout ---');
            const logoutRes = await fetch(`${BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Origin': 'http://localhost:3000'
                },
                body: JSON.stringify({ refreshToken: refreshData.data.refreshToken })
            });
            console.log('Logout status:', logoutRes.status);
            console.log('Logout response:', await logoutRes.text());
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
};

runTests();

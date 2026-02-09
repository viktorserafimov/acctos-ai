import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TENANT_ID = 'cml8tl8xl00023a8m50fckevr';

// Generate test token
const token = jwt.sign({
    id: 'test-user-id',
    email: 'test@example.com',
    tenantId: TENANT_ID
}, JWT_SECRET);

async function testMakeCheck() {
    try {
        console.log('Testing Make.com check endpoint...');
        const response = await axios.get('http://localhost:5000/v1/integrations/make/check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Error Response:', error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testMakeCheck();
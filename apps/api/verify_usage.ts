
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TENANT_ID = "cml8tl8xl00023a8m50fckevr"; // The tenant ID we used for ingestion

// Generate a test token
const token = jwt.sign({
    id: "test-user-id",
    email: "test@example.com",
    tenantId: TENANT_ID
}, JWT_SECRET);

async function verifyUsage() {
    try {
        console.log('--- Verifying Summary Endpoint ---');
        const summaryRes = await axios.get('http://localhost:5000/v1/usage/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Summary Result:', JSON.stringify(summaryRes.data, null, 2));

        console.log('\n--- Verifying Timeseries Endpoint ---');
        const timeseriesRes = await axios.get('http://localhost:5000/v1/usage/timeseries', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Timeseries Result:', JSON.stringify(timeseriesRes.data, null, 2));

    } catch (error: any) {
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

verifyUsage();

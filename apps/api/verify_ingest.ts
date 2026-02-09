
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const HMAC_SECRET = process.env.HMAC_SECRET || 'secret'; // fallback if not set in .env
console.log(`Using HMAC Secret: ${HMAC_SECRET}`);

const payload = {
    tenantId: "cml8tl8xl00023a8m50fckevr", // Use the tenant ID found in check_db.ts
    source: "make",
    documentType: "bank",
    fileType: "pdf",
    step: "ocr",
    cost: 0.05,
    tokens: 150,
    timestamp: new Date().toISOString()
};

const signature = 'sha256=' + crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

async function testIngest() {
    try {
        console.log('Sending request to http://localhost:5000/v1/events/ingest');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        console.log('Signature:', signature);

        const response = await axios.post('http://localhost:5000/v1/events/ingest', payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Signature': signature,
                'Idempotency-Key': `test-${Date.now()}`
            }
        });

        console.log('Success:', response.status, response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testIngest();

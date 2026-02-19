import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.USAGE_API_KEY || 'dev-test-api-key-change-in-production';
const BASE_URL = 'http://localhost:5000';
const CUSTOMER_ID = 'cml8tl8xl00023a8m50fckevr'; // From check_db.ts

console.log(`Using API Key: ${API_KEY}`);
console.log(`Testing with customer ID: ${CUSTOMER_ID}`);
console.log('');

/**
 * Test 1: POST valid document usage event
 */
async function testPostDocumentUsage() {
    console.log('=== Test 1: POST /api/usage/document (valid payload) ===');

    const payload = {
        customerId: CUSTOMER_ID,
        pagesSpent: 20,
        rowsUsed: 150,
        jobId: 'job-test-001',
        scenarioId: 'scenario-abc',
        scenarioName: 'Invoice Processing',
        timestamp: new Date().toISOString(),
    };

    try {
        const response = await axios.post(`${BASE_URL}/api/usage/document`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'Idempotency-Key': `test-doc-${Date.now()}`,
            },
        });
        console.log('✅ Success:', response.status, response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
    console.log('');
}

/**
 * Test 2: POST with duplicate idempotency key (should return duplicate status)
 */
async function testIdempotency() {
    console.log('=== Test 2: Idempotency Check ===');

    const idempotencyKey = `test-idem-${Date.now()}`;
    const payload = {
        customerId: CUSTOMER_ID,
        pagesSpent: 5,
        rowsUsed: 50,
    };

    try {
        // First request
        console.log('Sending first request...');
        const res1 = await axios.post(`${BASE_URL}/api/usage/document`, payload, {
            headers: {
                'X-API-Key': API_KEY,
                'Idempotency-Key': idempotencyKey,
            },
        });
        console.log('First request:', res1.status, res1.data.status);

        // Duplicate request with same idempotency key
        console.log('Sending duplicate request...');
        const res2 = await axios.post(`${BASE_URL}/api/usage/document`, payload, {
            headers: {
                'X-API-Key': API_KEY,
                'Idempotency-Key': idempotencyKey,
            },
        });
        console.log('Duplicate request:', res2.status, res2.data.status);

        if (res2.data.status === 'duplicate') {
            console.log('✅ Idempotency working correctly');
        } else {
            console.log('❌ Idempotency check failed');
        }
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
    console.log('');
}

/**
 * Test 3: POST multiple events to test aggregation
 */
async function testAggregation() {
    console.log('=== Test 3: Multiple events for aggregation ===');

    console.log('Sending 5 events with 10 pages and 25 rows each...');

    for (let i = 0; i < 5; i++) {
        try {
            const response = await axios.post(`${BASE_URL}/api/usage/document`, {
                customerId: CUSTOMER_ID,
                pagesSpent: 10,
                rowsUsed: 25,
                jobId: 'job-agg-test',
            }, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Idempotency-Key': `test-agg-${Date.now()}-${i}`,
                },
            });
            console.log(`Event ${i + 1}:`, response.data.status);
        } catch (error: any) {
            console.error(`❌ Event ${i + 1} failed:`, error.response?.data || error.message);
        }
    }
    console.log('Expected totals: 50 pages, 125 rows');
    console.log('✅ Aggregation test completed (verify with GET request)');
    console.log('');
}

/**
 * Test 4: GET document usage with date range
 */
async function testGetDocumentUsage() {
    console.log('=== Test 4: GET /api/usage/document (with date range) ===');

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    try {
        const response = await axios.get(`${BASE_URL}/api/usage/document`, {
            params: {
                customerId: CUSTOMER_ID,
                from: thirtyDaysAgo.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0],
            },
            headers: {
                'X-API-Key': API_KEY,
            },
        });
        console.log('✅ Success:', response.status);
        console.log('Response:');
        console.log('  Customer ID:', response.data.customerId);
        console.log('  Period:', response.data.from, 'to', response.data.to);
        console.log('  Days with data:', response.data.days.length);
        console.log('  Totals:', response.data.totals);

        if (response.data.days.length > 0) {
            console.log('  Sample day:', response.data.days[response.data.days.length - 1]);
        }
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
    console.log('');
}

/**
 * Test 5: GET without customerId (should fail)
 */
async function testGetWithoutCustomerId() {
    console.log('=== Test 5: GET /api/usage/document (missing customerId) ===');

    try {
        const response = await axios.get(`${BASE_URL}/api/usage/document`, {
            headers: {
                'X-API-Key': API_KEY,
            },
        });
        console.log('❌ Should have failed but got:', response.status);
    } catch (error: any) {
        if (error.response && error.response.status === 400) {
            console.log('✅ Correctly returned 400:', error.response.data);
        } else {
            console.error('❌ Unexpected error:', error.response?.status, error.response?.data || error.message);
        }
    }
    console.log('');
}

/**
 * Test 6: POST with invalid API key (should fail)
 */
async function testInvalidApiKey() {
    console.log('=== Test 6: POST with invalid API key ===');

    try {
        const response = await axios.post(`${BASE_URL}/api/usage/document`, {
            customerId: CUSTOMER_ID,
            pagesSpent: 1,
            rowsUsed: 1,
        }, {
            headers: {
                'X-API-Key': 'invalid-api-key',
                'Idempotency-Key': `test-invalid-${Date.now()}`,
            },
        });
        console.log('❌ Should have failed but got:', response.status);
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            console.log('✅ Correctly returned 401:', error.response.data);
        } else {
            console.error('❌ Unexpected error:', error.response?.status, error.response?.data || error.message);
        }
    }
    console.log('');
}

/**
 * Test 7: POST with negative values (should fail)
 */
async function testNegativeValues() {
    console.log('=== Test 7: POST with negative values ===');

    try {
        const response = await axios.post(`${BASE_URL}/api/usage/document`, {
            customerId: CUSTOMER_ID,
            pagesSpent: -10,
            rowsUsed: 50,
        }, {
            headers: {
                'X-API-Key': API_KEY,
                'Idempotency-Key': `test-negative-${Date.now()}`,
            },
        });
        console.log('❌ Should have failed but got:', response.status);
    } catch (error: any) {
        if (error.response && error.response.status === 400) {
            console.log('✅ Correctly returned 400:', error.response.data);
        } else {
            console.error('❌ Unexpected error:', error.response?.status, error.response?.data || error.message);
        }
    }
    console.log('');
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🧪 Starting Document Usage API Tests\n');
    console.log('='.repeat(60));
    console.log('');

    await testPostDocumentUsage();
    await testIdempotency();
    await testAggregation();
    await testGetDocumentUsage();
    await testGetWithoutCustomerId();
    await testInvalidApiKey();
    await testNegativeValues();

    console.log('='.repeat(60));
    console.log('✅ All tests completed!');
}

runAllTests();

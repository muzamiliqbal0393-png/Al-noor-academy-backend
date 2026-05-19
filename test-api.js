/**
 * Backend API Test Suite
 * Tests connection between backend and database
 */

const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const tests = {
    results: [],
    errors: []
};

// ===== UTILITY FUNCTIONS =====
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',     // Cyan
        success: '\x1b[32m',  // Green
        error: '\x1b[31m',    // Red
        warning: '\x1b[33m',  // Yellow
        reset: '\x1b[0m'      // Reset
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ===== TESTS =====
async function testMongoConnection() {
    log('\n📊 Testing MongoDB Connection...', 'info');
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        log(`✅ MongoDB Connected: ${process.env.MONGO_URI}`, 'success');
        tests.results.push({
            test: 'MongoDB Connection',
            status: 'PASS',
            message: `Connected to ${process.env.MONGO_URI}`
        });
        return true;
    } catch (error) {
        log(`❌ MongoDB Error: ${error.message}`, 'error');
        tests.results.push({
            test: 'MongoDB Connection',
            status: 'FAIL',
            message: error.message,
            suggestion: 'Make sure MongoDB is running. Run: mongod'
        });
        tests.errors.push(error.message);
        return false;
    }
}

async function testHealthCheck() {
    log('\n🏥 Testing Backend Health Check...', 'info');
    try {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 5000,
            path: '/',
            method: 'GET',
            timeout: 5000
        };
        
        const response = await makeRequest(options);
        if (response.status === 200) {
            log(`✅ Backend is Running on port ${process.env.PORT || 5000}`, 'success');
            log(`   Response: ${response.body.message}`, 'info');
            tests.results.push({
                test: 'Backend Health Check',
                status: 'PASS',
                message: response.body.message,
                port: process.env.PORT || 5000
            });
            return true;
        } else {
            throw new Error(`Status ${response.status}`);
        }
    } catch (error) {
        log(`❌ Backend Error: ${error.message}`, 'error');
        tests.results.push({
            test: 'Backend Health Check',
            status: 'FAIL',
            message: error.message,
            suggestion: `Make sure backend is running on port ${process.env.PORT || 5000}. Run: npm start or npm run dev`
        });
        tests.errors.push(error.message);
        return false;
    }
}

async function testCORSSetup() {
    log('\n🔒 Testing CORS Configuration...', 'info');
    try {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 5000,
            path: '/',
            method: 'OPTIONS',
            headers: {
                'Origin': process.env.CLIENT_URL || 'http://localhost:3000'
            },
            timeout: 5000
        };
        
        const response = await makeRequest(options);
        const corsHeader = response.headers['access-control-allow-origin'];
        
        if (corsHeader) {
            log(`✅ CORS is Configured: ${corsHeader}`, 'success');
            tests.results.push({
                test: 'CORS Setup',
                status: 'PASS',
                message: `CORS allows: ${corsHeader}`
            });
            return true;
        } else {
            log(`⚠️  CORS Header not found`, 'warning');
            tests.results.push({
                test: 'CORS Setup',
                status: 'WARNING',
                message: 'CORS header not present in response'
            });
            return false;
        }
    } catch (error) {
        log(`❌ CORS Test Error: ${error.message}`, 'error');
        tests.results.push({
            test: 'CORS Setup',
            status: 'FAIL',
            message: error.message
        });
        return false;
    }
}

async function testAuthRoute() {
    log('\n🔐 Testing Auth Route...', 'info');
    try {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 5000,
            path: '/api/auth',
            method: 'GET',
            timeout: 5000
        };
        
        const response = await makeRequest(options);
        if (response.status < 500) {
            log(`✅ Auth Route Accessible (Status: ${response.status})`, 'success');
            tests.results.push({
                test: 'Auth Route',
                status: 'PASS',
                message: `Route accessible with status ${response.status}`
            });
            return true;
        }
    } catch (error) {
        log(`⚠️  Auth Route Error: ${error.message}`, 'warning');
        tests.results.push({
            test: 'Auth Route',
            status: 'WARNING',
            message: error.message
        });
        return false;
    }
}

async function testEnvironment() {
    log('\n📋 Testing Environment Configuration...', 'info');
    const required = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'NODE_ENV'];
    let allPresent = true;
    
    for (const key of required) {
        if (process.env[key]) {
            log(`✅ ${key} = ${key === 'MONGO_URI' ? process.env[key] : '***'}`, 'success');
        } else {
            log(`❌ ${key} is missing!`, 'error');
            allPresent = false;
        }
    }
    
    tests.results.push({
        test: 'Environment Configuration',
        status: allPresent ? 'PASS' : 'FAIL',
        message: allPresent ? 'All required environment variables are set' : 'Some environment variables are missing'
    });
    
    return allPresent;
}

// ===== MAIN TEST RUNNER =====
async function runTests() {
    log('\n' + '='.repeat(60), 'info');
    log('🧪 AL-NOOR QURAN ACADEMY - BACKEND CONNECTION TEST', 'info');
    log('='.repeat(60), 'info');
    
    log(`\n⏰ Test started at ${new Date().toLocaleString()}`, 'info');
    
    await testEnvironment();
    await testMongoConnection();
    await testHealthCheck();
    await testCORSSetup();
    await testAuthRoute();
    
    // ===== SUMMARY =====
    log('\n' + '='.repeat(60), 'info');
    log('📈 TEST SUMMARY', 'info');
    log('='.repeat(60), 'info');
    
    tests.results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️ ';
        log(`${icon} ${result.test}: ${result.status}`, 
            result.status === 'PASS' ? 'success' : result.status === 'FAIL' ? 'error' : 'warning');
        if (result.message) {
            log(`   ${result.message}`, 'info');
        }
        if (result.suggestion) {
            log(`   💡 ${result.suggestion}`, 'warning');
        }
    });
    
    const passed = tests.results.filter(r => r.status === 'PASS').length;
    const failed = tests.results.filter(r => r.status === 'FAIL').length;
    const warnings = tests.results.filter(r => r.status === 'WARNING').length;
    
    log(`\n📊 Results: ${passed} passed, ${failed} failed, ${warnings} warnings`, 'info');
    log(`\n⏰ Test completed at ${new Date().toLocaleString()}`, 'info');
    
    if (failed === 0) {
        log('\n🎉 All critical tests passed!', 'success');
    } else {
        log('\n⚠️  Some tests failed. Check the errors above.', 'error');
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
    log(`Fatal Error: ${err.message}`, 'error');
    process.exit(1);
});

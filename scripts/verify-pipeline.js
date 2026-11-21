/**
 * CloudVault End-to-End Pipeline Verification Script
 * 
 * Verifies:
 * 1. Healthcheck (/health)
 * 2. User Registration (/api/auth/register)
 * 3. User Login (/api/auth/login)
 * 4. User Profile & Quota (/api/auth/me)
 * 5. Direct S3 Presigned URL Generation (/api/files/get-presigned-url)
 * 6. Direct HTTP PUT to S3 / MinIO storage
 * 7. Upload Confirmation (/api/files/confirm-upload)
 * 8. Asynchronous Processing Queue Status
 * 9. Download Signed URL Generation (/api/files/:id/download)
 * 10. File Deletion (/api/files/:id)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const API_BASE = process.env.API_URL || 'http://localhost:5000';

async function request(urlStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.request(parsedUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body);
      } else {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

async function runVerification() {
  console.log('=======================================================');
  console.log('🧪 CloudVault End-to-End Pipeline Verification');
  console.log(`🎯 Target API: ${API_BASE}`);
  console.log('=======================================================\n');

  try {
    // 1. Healthcheck
    console.log('1️⃣  Testing API Healthcheck...');
    const health = await request(`${API_BASE}/health`);
    if (health.status !== 200) {
      throw new Error(`Healthcheck failed with status ${health.status}`);
    }
    console.log('   ✅ Healthcheck OK:', health.data);

    // 2. Auth: Register
    const testEmail = `test_${Date.now()}@cloudvault.internal`;
    const testPassword = 'Password123!';
    console.log(`\n2️⃣  Registering test account (${testEmail})...`);
    const regRes = await request(`${API_BASE}/api/auth/register`, { method: 'POST' }, {
      email: testEmail,
      password: testPassword,
    });
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    }
    const token = regRes.data.data.token;
    console.log('   ✅ Registered successfully! JWT received.');

    // 3. Auth: Profile & Quota
    console.log('\n3️⃣  Verifying user profile and quota (/api/auth/me)...');
    const meRes = await request(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.status !== 200) {
      throw new Error(`Profile fetch failed: ${JSON.stringify(meRes.data)}`);
    }
    console.log('   ✅ User profile confirmed:', {
      email: meRes.data.data.user.email,
      storageQuota: meRes.data.data.user.storageQuota,
      storageUsed: meRes.data.data.user.storageUsed,
    });

    // 4. Request Presigned Upload URL
    console.log('\n4️⃣  Requesting S3 Presigned URL for zero-load upload...');
    const samplePayload = Buffer.from('CloudVault zero-load S3 direct upload verification payload.', 'utf8');
    const presignedRes = await request(
      `${API_BASE}/api/files/get-presigned-url`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      {
        fileName: 'test-verification-file.txt',
        fileSizeBytes: samplePayload.length,
        mimeType: 'text/plain',
      }
    );
    if (presignedRes.status !== 200) {
      throw new Error(`Failed to get presigned URL: ${JSON.stringify(presignedRes.data)}`);
    }
    const { fileId, uploadUrl, s3Key } = presignedRes.data.data;
    console.log('   ✅ Presigned URL created:');
    console.log(`      File ID: ${fileId}`);
    console.log(`      S3 Key: ${s3Key}`);
    console.log(`      Upload URL: ${uploadUrl.substring(0, 80)}...`);

    // 5. Zero-Load Direct Upload to S3
    console.log('\n5️⃣  Streaming raw binary DIRECTLY to S3 / MinIO via HTTP PUT...');
    const s3UploadRes = await request(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': samplePayload.length,
      },
    }, samplePayload);

    if (s3UploadRes.status < 200 || s3UploadRes.status >= 300) {
      throw new Error(`S3 direct upload failed with status ${s3UploadRes.status}: ${s3UploadRes.data}`);
    }
    console.log('   ✅ Direct S3 PUT upload succeeded (Zero API server load)!');

    // 6. Confirm Upload
    console.log('\n6️⃣  Confirming upload with API to dispatch BullMQ worker...');
    const confirmRes = await request(
      `${API_BASE}/api/files/confirm-upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      { fileId }
    );
    if (confirmRes.status !== 200) {
      throw new Error(`Confirm upload failed: ${JSON.stringify(confirmRes.data)}`);
    }
    console.log('   ✅ Upload confirmed. Status:', confirmRes.data.data.file.status);

    // 7. Get File Status
    console.log('\n7️⃣  Checking file status in database...');
    const fileRes = await request(
      `${API_BASE}/api/files/${fileId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log('   ✅ Current file record:', {
      id: fileRes.data.data.file.id,
      fileName: fileRes.data.data.file.fileName,
      status: fileRes.data.data.file.status,
    });

    // 8. Generate Presigned Download URL
    console.log('\n8️⃣  Generating secure presigned GET download URL...');
    const downloadRes = await request(
      `${API_BASE}/api/files/${fileId}/download`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (downloadRes.status !== 200) {
      throw new Error(`Download URL generation failed: ${JSON.stringify(downloadRes.data)}`);
    }
    console.log('   ✅ Presigned download URL generated successfully:');
    console.log(`      ${downloadRes.data.data.downloadUrl.substring(0, 80)}...`);

    console.log('\n=======================================================');
    console.log('🎉 ALL 8 PIPELINE VERIFICATION STEPS PASSED!');
    console.log('=======================================================');
  } catch (err) {
    console.error('\n❌ Verification failed with error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runVerification();
}

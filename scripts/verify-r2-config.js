/**
 * Verify R2 environment variables are present
 * Run with: node scripts/verify-r2-config.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

console.log('🔍 Verifying R2 Configuration...\n');

const requiredVars = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
];

let allPresent = true;

requiredVars.forEach((key) => {
  const value = process.env[key];
  if (value && value.trim() !== '') {
    const maskedValue =
      key.includes('SECRET') || key.includes('KEY')
        ? '***' + value.slice(-4)
        : value;
    console.log(`✓ ${key}: ${maskedValue}`);
  } else {
    console.log(`✗ ${key}: NOT SET`);
    allPresent = false;
  }
});

console.log('\n');

if (allPresent) {
  console.log('✅ All R2 environment variables are configured');
  console.log('\nR2 Endpoint that will be used:');
  console.log(
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  );
  console.log('\nNext steps:');
  console.log('1. Verify the bucket exists in Cloudflare R2 dashboard');
  console.log('2. Verify API token has "Object Read & Write" permissions');
  console.log('3. Start the dev server: npm run dev');
  console.log('4. Test upload in admin panel: http://localhost:3000/admin/products/new');
} else {
  console.log('❌ Some R2 environment variables are missing');
  console.log('\nAdd them to .env.local file:');
  console.log('R2_ACCOUNT_ID=your_account_id');
  console.log('R2_ACCESS_KEY_ID=your_access_key_id');
  console.log('R2_SECRET_ACCESS_KEY=your_secret_access_key');
  console.log('R2_BUCKET_NAME=mivo-stl-originals');
  process.exit(1);
}

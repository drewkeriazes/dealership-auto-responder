require('dotenv').config();

const REQUIRED = [
  { key: 'ANTHROPIC_API_KEY', hint: 'Get yours at https://console.anthropic.com' },
  { key: 'GOOGLE_CLIENT_ID', hint: 'From Google Cloud Console > APIs & Services > Credentials' },
  { key: 'GOOGLE_CLIENT_SECRET', hint: 'From Google Cloud Console > APIs & Services > Credentials' },
  { key: 'GOOGLE_REDIRECT_URI', hint: 'Should be: http://localhost:3000/auth/callback' },
];

console.log('\n========================================');
console.log('  Dealership Email App — Setup Check');
console.log('========================================\n');

let allGood = true;

for (const { key, hint } of REQUIRED) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    console.error(`  ✗ MISSING: ${key}`);
    console.error(`    → ${hint}\n`);
    allGood = false;
  } else {
    const preview = val.length > 8 ? val.slice(0, 4) + '...' + val.slice(-4) : '****';
    console.log(`  ✓ ${key} (${preview})`);
  }
}

// Check optional but warn if default
const port = process.env.PORT || '3000';
const interval = process.env.CHECK_INTERVAL_MINUTES || '10';
console.log(`\n  ℹ PORT: ${port}`);
console.log(`  ℹ CHECK_INTERVAL_MINUTES: ${interval} (inbox checked every ${interval} minutes)`);

if (allGood) {
  console.log('\n  All required settings are present!');
  console.log('  Run the app with:  node server.js\n');
} else {
  console.log('\n  Please fill in the missing values in your .env file,');
  console.log('  then run this check again.\n');
  process.exit(1);
}

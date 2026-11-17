// Prints a new pair of push-notification (VAPID) keys. Run once: npm run keys
import { generateVapidKeys } from '../src/push.js';
const k = generateVapidKeys();
console.log('Add these two values in Render → Environment:\n');
console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
console.log('\nKeep the private key secret. Changing the keys later means every device must turn FT Alerts on again.');

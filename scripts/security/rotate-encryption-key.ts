#!/usr/bin/env tsx
/**
 * ENCRYPTION_KEY rotation script
 *
 * Phase: Access Model v2 Phase 0.9 (audit-derived deliverable)
 * Source: IT audit F9 (HIGH) + access-model-v2.md §3 item #32
 *
 * USAGE:
 *
 *   ENCRYPTION_KEY_OLD=<hex64> \
 *   ENCRYPTION_KEY_NEW=<hex64> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<svc-key> \
 *   tsx scripts/security/rotate-encryption-key.ts [--dry-run]
 *
 * Re-encrypts every encrypted column (encrypted_api_key,
 * encrypted_api_token, lti_consumer_secret) by:
 *   1. SELECT all rows with non-null encrypted columns
 *   2. Decrypt with ENCRYPTION_KEY_OLD
 *   3. Re-encrypt with ENCRYPTION_KEY_NEW
 *   4. UPDATE the row atomically
 *
 * After successful run:
 *   - Update ENCRYPTION_KEY env var in Vercel + .env.local to NEW value
 *   - Restart the app
 *   - Discard the OLD key (do NOT keep — that defeats rotation)
 *
 * SAFETY:
 *   - --dry-run flag: SELECT + decrypt + re-encrypt + verify roundtrip
 *     but DO NOT UPDATE. Confirms every row's data survives the
 *     transformation before committing.
 *   - Per-row UPDATEs (not batch). If a single row fails, others are
 *     already migrated; script reports which rows succeeded.
 *   - Validates the key shapes before doing anything (must be 64-char
 *     hex strings — 32 bytes — for AES-256).
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

interface EncryptedColumn {
  table: string;
  pk: string;
  column: string;
}

// All columns in the schema that store AES-256-GCM ciphertext via
// src/lib/encryption.ts. Keep this list in sync with the actual
// encrypt() callsites.
const ENCRYPTED_COLUMNS: EncryptedColumn[] = [
  { table: 'ai_settings', pk: 'teacher_id', column: 'encrypted_api_key' },
  { table: 'teacher_integrations', pk: 'id', column: 'encrypted_api_token' },
  { table: 'teacher_integrations', pk: 'id', column: 'lti_consumer_secret' },
];

function getKey(envVar: string): Buffer {
  const v = process.env[envVar];
  if (!v) {
    throw new Error(`${envVar} environment variable is not set`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error(
      `${envVar} must be a 64-character hex string (32 bytes for AES-256). Got length ${v.length}.`
    );
  }
  return Buffer.from(v, 'hex');
}

function decryptWithKey(encryptedStr: string, key: Buffer): string {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid encrypted string format (expected iv:ct:tag, got ${parts.length} parts)`);
  }
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];
  const tag = Buffer.from(parts[2], 'base64');
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted}:${tag.toString('base64')}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const oldKey = getKey('ENCRYPTION_KEY_OLD');
  const newKey = getKey('ENCRYPTION_KEY_NEW');

  if (oldKey.equals(newKey)) {
    console.error('ENCRYPTION_KEY_OLD and ENCRYPTION_KEY_NEW are identical. Aborting.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Rotating ENCRYPTION_KEY across ${ENCRYPTED_COLUMNS.length} columns\n`);

  let totalRows = 0;
  let totalRotated = 0;
  let totalFailed = 0;

  for (const ec of ENCRYPTED_COLUMNS) {
    console.log(`\n--- ${ec.table}.${ec.column} ---`);

    const { data: rows, error } = await supabase
      .from(ec.table)
      .select(`${ec.pk}, ${ec.column}`)
      .not(ec.column, 'is', null);

    if (error) {
      console.error(`  ✗ SELECT failed: ${error.message}`);
      totalFailed += 1;
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log('  (no rows to rotate)');
      continue;
    }

    console.log(`  Found ${rows.length} encrypted row(s)`);
    totalRows += rows.length;

    for (const row of rows as Record<string, unknown>[]) {
      const pkValue = row[ec.pk];
      const ciphertext = row[ec.column] as string;

      let plaintext: string;
      try {
        plaintext = decryptWithKey(ciphertext, oldKey);
      } catch (e) {
        console.error(`    ✗ ${ec.pk}=${pkValue}: decrypt-with-old failed (${(e as Error).message})`);
        totalFailed += 1;
        continue;
      }

      let newCipher: string;
      try {
        newCipher = encryptWithKey(plaintext, newKey);
      } catch (e) {
        console.error(`    ✗ ${ec.pk}=${pkValue}: encrypt-with-new failed (${(e as Error).message})`);
        totalFailed += 1;
        continue;
      }

      // Verify roundtrip: decrypt newCipher with newKey should equal plaintext
      try {
        const verify = decryptWithKey(newCipher, newKey);
        if (verify !== plaintext) {
          console.error(`    ✗ ${ec.pk}=${pkValue}: roundtrip mismatch — DATA WOULD BE CORRUPTED. Skipping.`);
          totalFailed += 1;
          continue;
        }
      } catch (e) {
        console.error(`    ✗ ${ec.pk}=${pkValue}: roundtrip verify failed (${(e as Error).message})`);
        totalFailed += 1;
        continue;
      }

      if (dryRun) {
        console.log(`    [dry] ${ec.pk}=${pkValue}: would update (roundtrip verified)`);
        totalRotated += 1;
        continue;
      }

      const { error: updateErr } = await supabase
        .from(ec.table)
        .update({ [ec.column]: newCipher })
        .eq(ec.pk, pkValue);

      if (updateErr) {
        console.error(`    ✗ ${ec.pk}=${pkValue}: UPDATE failed: ${updateErr.message}`);
        totalFailed += 1;
        continue;
      }

      console.log(`    ✓ ${ec.pk}=${pkValue}: rotated`);
      totalRotated += 1;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Total encrypted rows scanned: ${totalRows}`);
  console.log(`  ${dryRun ? 'Would rotate' : 'Rotated'}:           ${totalRotated}`);
  console.log(`  Failed:                       ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('\n⛔ Some rows failed. Investigate before retrying.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] All rows roundtripped cleanly. Re-run WITHOUT --dry-run to actually rotate.');
  } else {
    console.log('\n✓ Rotation complete.');
    console.log('\nNext steps:');
    console.log('  1. Update ENCRYPTION_KEY in Vercel env vars to the NEW key value');
    console.log('  2. Update local .env.local to match');
    console.log('  3. Restart app (Vercel redeploy)');
    console.log('  4. Verify a teacher BYOK flow still works (decrypt path uses new key)');
    console.log('  5. SECURELY DESTROY the OLD key — rotation only works if old is gone');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

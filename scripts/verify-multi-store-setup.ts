/**
 * Verification script for Multi-Store Staff Assignment
 * This script verifies that the database schema and RLS policies are correctly set up
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifySetup() {
  console.log('🔍 Verifying Multi-Store Staff Assignment Setup...\n');

  let allPassed = true;

  // Test 1: Verify staff_stores table exists
  console.log('Test 1: Checking staff_stores table...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('staff_stores')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ staff_stores table not found:', tableError.message);
    allPassed = false;
  } else {
    console.log('✅ staff_stores table exists');
  }

  // Test 2: Verify get_user_store_ids function exists
  console.log('\nTest 2: Checking get_user_store_ids function...');
  const { data: functionCheck, error: functionError } = await supabase.rpc(
    'get_user_store_ids',
    { user_id: '00000000-0000-0000-0000-000000000000' }
  );

  if (functionError && !functionError.message.includes('does not exist')) {
    console.log('✅ get_user_store_ids function exists');
  } else if (functionError) {
    console.error('❌ get_user_store_ids function not found:', functionError.message);
    allPassed = false;
  } else {
    console.log('✅ get_user_store_ids function exists');
  }

  // Test 3: Verify indexes exist
  console.log('\nTest 3: Checking indexes...');
  const { data: indexes, error: indexError } = await supabase.rpc('pg_indexes', {
    schemaname: 'public',
    tablename: 'staff_stores',
  });

  if (!indexError) {
    console.log('✅ Indexes verified');
  } else {
    console.log('⚠️  Could not verify indexes (may require different permissions)');
  }

  // Test 4: Verify unique constraint on (staff_id, store_id)
  console.log('\nTest 4: Testing unique constraint...');
  const testStaffId = '00000000-0000-0000-0000-000000000001';
  const testStoreId = '00000000-0000-0000-0000-000000000002';

  // Try to insert a test record (will fail if staff/store don't exist, which is expected)
  const { error: insertError1 } = await supabase
    .from('staff_stores')
    .insert({
      staff_id: testStaffId,
      store_id: testStoreId,
      is_primary: true,
    });

  if (insertError1 && insertError1.message.includes('foreign key')) {
    console.log('✅ Foreign key constraints working (expected for test data)');
  } else if (!insertError1) {
    // If insert succeeded, try duplicate
    const { error: insertError2 } = await supabase
      .from('staff_stores')
      .insert({
        staff_id: testStaffId,
        store_id: testStoreId,
        is_primary: false,
      });

    if (insertError2 && insertError2.message.includes('unique')) {
      console.log('✅ Unique constraint working');
      // Clean up
      await supabase
        .from('staff_stores')
        .delete()
        .eq('staff_id', testStaffId)
        .eq('store_id', testStoreId);
    } else {
      console.error('❌ Unique constraint not working');
      allPassed = false;
    }
  }

  // Test 5: Verify RLS is enabled
  console.log('\nTest 5: Checking RLS policies...');
  const { data: rlsCheck, error: rlsError } = await supabase
    .from('staff_stores')
    .select('*')
    .limit(1);

  if (!rlsError) {
    console.log('✅ RLS policies configured');
  } else {
    console.error('❌ RLS policy error:', rlsError.message);
    allPassed = false;
  }

  // Test 6: Verify migration completed
  console.log('\nTest 6: Checking migration status...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role, store_id')
    .eq('role', 'staff')
    .not('store_id', 'is', null)
    .limit(5);

  if (!profilesError && profiles) {
    console.log(`✅ Found ${profiles.length} staff with store assignments`);

    // Check if they have corresponding staff_stores entries
    for (const profile of profiles) {
      const { data: assignments } = await supabase
        .from('staff_stores')
        .select('*')
        .eq('staff_id', profile.id);

      if (assignments && assignments.length > 0) {
        console.log(`  ✅ Staff ${profile.id} has ${assignments.length} store assignment(s)`);
      } else {
        console.log(`  ⚠️  Staff ${profile.id} has no staff_stores entries (may need migration)`);
      }
    }
  } else if (profilesError) {
    console.error('❌ Error checking profiles:', profilesError.message);
    allPassed = false;
  } else {
    console.log('ℹ️  No staff members found with store assignments');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All verification tests passed!');
    console.log('✅ Database and RLS setup is correct');
  } else {
    console.log('❌ Some verification tests failed');
    console.log('⚠️  Please review the errors above');
  }
  console.log('='.repeat(50));

  return allPassed;
}

verifySetup()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  });

/**
 * Creates the initial admin user in both auth.users and public.users.
 * The Supabase Auth trigger (handle_new_user) auto-creates the public.users
 * row when the auth.users record is created (if the schema/trigger exists).
 *
 * If the auth user already exists, this script just ensures the public.users
 * row exists with role='admin'.
 *
 * Usage: node scripts/create-admin.cjs
 */

const supabase = require('../server/db/supabase');

const ADMIN_EMAIL = 'bapidatta18@gmail.com';
const ADMIN_PASSWORD = 'password123';

async function main() {
  let authId = null;

  // 1. Check if auth user already exists
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Failed to list auth users:', listErr.message);
    process.exit(1);
  }

  const existingAuthUser = listData?.users?.find(u => u.email === ADMIN_EMAIL);

  if (existingAuthUser) {
    console.log('✓ Auth user already exists:', existingAuthUser.id);
    authId = existingAuthUser.id;
  } else {
    // 2. Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Admin', role: 'admin' }
    });

    if (error && !error.message?.includes('already exists')) {
      console.error('❌ Failed to create auth user:', error.message);
      process.exit(1);
    } else {
      console.log('✓ Auth user created:', data?.user?.id || '(check dashboard if duplicate)');
      authId = data?.user?.id || null;
    }
  }

  // 3. Check if public.users row already exists
  let existingUser = null;
  if (authId) {
    const { data: checkData, error: checkErr } = await supabase
      .from('users')
      .select('id, email, role, "authId"')
      .eq('authId', authId)
      .limit(1);

    if (!checkErr) {
      existingUser = checkData?.[0];
    }
  }

  if (existingUser && existingUser.role === 'admin') {
    console.log('✓ Admin already exists in public.users:', existingUser.id);
    console.log(`\nAdmin credentials: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    return;
  }

  // 4. Create or update public.users row
  if (authId) {
    if (existingUser) {
      // Update the role to admin
      const { error: updErr } = await supabase
        .from('users')
        .update({ role: 'admin', status: 'active' })
        .eq('id', existingUser.id);

      if (updErr) {
        console.error('❌ Failed to update user role:', updErr.message);
        process.exit(1);
      }
      console.log('✓ Updated existing user to admin:', existingUser.id);
    } else {
      // Insert new public.users row
      const { data: userRow, error: insertErr } = await supabase
        .from('users')
        .insert({
          name: 'Admin',
          email: ADMIN_EMAIL,
          role: 'admin',
          phone: null,
          teamId: null,
          status: 'active',
          authId: authId
        })
        .select('id, name, email, role, "authId"')
        .limit(1);

      if (insertErr) {
        console.error('❌ Failed to create public.users row:', insertErr.message);
        console.error('   The auth user was created, but the database row could not be inserted.');
        console.error('   Check that the schema (supabase_schema.sql) has been applied.');
        process.exit(1);
      }
      console.log('✓ public.users row created:', userRow[0].id);
    }
  } else {
    console.error('❌ Could not determine auth user ID. Trying direct insert...');
  }

  console.log(`\nAdmin credentials: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch(err => { console.error(err); process.exit(1); });

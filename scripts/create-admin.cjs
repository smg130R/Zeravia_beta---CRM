/**
 * Creates the initial admin user in both auth.users and public.users.
 * The Supabase Auth trigger (handle_new_user) automatically creates
 * the public.users row when the auth.users record is created.
 *
 * Usage: node scripts/create-admin.cjs
 */

const supabase = require('../server/db/supabase');

const ADMIN_EMAIL = 'bapidatta18@gmail.com';
const ADMIN_PASSWORD = 'password123';

async function main() {
  // Check if admin already exists in auth.users
  const { data: existing } = await supabase
    .from('users')
    .select('id, email, "authId"')
    .eq('email', ADMIN_EMAIL)
    .limit(1);

  if (existing?.[0]?.authId) {
    console.log(`✓ Admin already exists (authId: ${existing[0].authId})`);
    return;
  }

  if (existing?.[0] && !existing[0].authId) {
    console.log('⚠️  Admin exists in public.users but without authId.');
    console.log('   You need to create an auth.users entry manually via Supabase Dashboard.');
    console.log('   Then set the authId on the existing user row.');
    return;
  }

  // Create admin via Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin' }
  });

  if (error) {
    console.error('❌ Failed to create admin:', error.message);
    process.exit(1);
  }

  console.log(`✓ Admin created in auth.users: ${data.user.id}`);

  // Create public.users row directly
  const { data: userRow, error: insertErr } = await supabase
    .from('users')
    .insert({
      name: 'Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      phone: null,
      teamId: null,
      status: 'active',
      authId: data.user.id
    })
    .select('id, name, email, role, "authId"')
    .limit(1);

  if (insertErr) {
    console.error('❌ Failed to create public.users row:', insertErr.message);
    process.exit(1);
  }

  console.log(`✓ public.users row created: id=${userRow[0].id}, role=${userRow[0].role}`);

  console.log(`\nAdmin credentials: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch(err => { console.error(err); process.exit(1); });

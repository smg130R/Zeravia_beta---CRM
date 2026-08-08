const supabase = require('./supabase');

// Database initialization function
// Verifies Supabase connection and tables exist

/**
 * Database initialization function
 * Verifies Supabase connection and tables exist
 * 
 * Note: Database tables should be created manually in Supabase Dashboard
 * using the SQL from server/db/supabase_schema.sql
 */
async function initDb() {
  try {
    // Verify Supabase connection by checking the users table
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(0);

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('');
        console.warn('⚠ Supabase tables not found. The schema needs to be applied:');
        console.warn('');
        console.warn('  1. Go to Supabase Dashboard → project "iedciyoeiovngdhrkplo"');
        console.warn('  2. SQL Editor → paste server/db/supabase_schema.sql → Run');
        console.warn('  3. Run: node scripts/create-admin.cjs');
        console.warn('  4. Restart: node server.js');
        console.warn('');
        console.warn('  (If using a different project, ensure .env has matching keys)');
        console.warn('');
      } else {
        console.warn('⚠ Supabase connection error:', error.message);
      }
      console.warn('  Server starting anyway — API routes will fail until tables exist.');
      return false;
    }

    console.log('✓ Connected to Supabase database');
    console.log('✓ Database tables verified');

    return true;
  } catch (error) {
    console.warn('⚠ Supabase initialization error:', error.message);
    console.warn('  Server starting anyway — API routes will fail until DB is configured.');
    return false;
  }
}

module.exports = {
  supabase,
  initDb
};

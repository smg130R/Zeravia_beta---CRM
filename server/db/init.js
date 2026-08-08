const supabase = require('./supabase');
const supabaseUrl = process.env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'your-project';

async function initDb() {
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(0);

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('');
        console.warn('⚠ Supabase tables not found. Apply the schema:');
        console.warn('');
        console.warn('  1. Supabase Dashboard → project "' + projectRef + '" → SQL Editor');
        console.warn('  2. Paste server/db/supabase_schema.sql → Run');
        console.warn('  3. node scripts/create-admin.cjs');
        console.warn('  4. node server.js');
        console.warn('');
      } else {
        console.warn('⚠ Supabase error:', error.message);
      }
      console.warn('  Server starting anyway — API routes will fail until tables exist.');
      return false;
    }

    console.log('✓ Connected to Supabase database');
    console.log('✓ Database tables verified');
    return true;
  } catch (error) {
    console.warn('⚠ Supabase init error:', error.message);
    console.warn('  Server starting anyway — API routes will fail until DB is configured.');
    return false;
  }
}

module.exports = {
  supabase,
  initDb
};

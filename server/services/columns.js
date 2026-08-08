const supabase = require('../db/supabase');

// Detect which of the given columns do NOT exist on a table (live-DB schema drift).
// Results are cached per table for the lifetime of the server process.
const cache = new Map();

async function getMissingColumns(table, candidates) {
  if (cache.has(table)) return cache.get(table);
  const missing = new Set();
  for (const c of candidates) {
    const { error } = await supabase.from(table).select(c).limit(1);
    if (error) missing.add(c);
  }
  cache.set(table, missing);
  return missing;
}

// Return a copy of `row` without keys whose columns don't exist on `table`.
async function pruneRow(row, table, candidates) {
  const missing = await getMissingColumns(table, candidates);
  if (missing.size === 0) return row;
  const out = { ...row };
  for (const c of missing) delete out[c];
  return out;
}

async function pruneRows(rows, table, candidates) {
  if (!rows || rows.length === 0) return rows;
  const missing = await getMissingColumns(table, candidates);
  if (missing.size === 0) return rows;
  return rows.map(row => {
    const out = { ...row };
    for (const c of missing) delete out[c];
    return out;
  });
}

module.exports = { getMissingColumns, pruneRow, pruneRows };

const supabase = require('../db/supabase');
const { smartCleanRow } = require('./smartClean');

// ── Team Config (masterSheetUrl on teams table) ──

// Detect leads-table columns that don't exist on the live DB (schema drift) so
// inserts/updates can omit them instead of failing. Cached per server process.
let cachedMissingLeadCols = null;

async function getMissingLeadCols() {
  if (cachedMissingLeadCols) return cachedMissingLeadCols;
  const candidates = ['whatsapp', 'sheetRow', 'email', 'remarks', 'payment_status', 'slot_amount', 'amount_paid', 'remaining'];
  const missing = new Set();
  for (const c of candidates) {
    const { error } = await supabase.from('leads').select(c).limit(1);
    if (error) missing.add(c);
  }
  cachedMissingLeadCols = missing;
  return missing;
}

function stripMissingCols(row, missing) {
  const out = { ...row };
  for (const c of missing) delete out[c];
  return out;
}

async function getMasterSheetUrl(teamId) {
  const { data } = await supabase.from('teams').select('"masterSheetUrl"').eq('id', teamId).limit(1).maybeSingle();
  return data?.masterSheetUrl || '';
}

async function setMasterSheetUrl(teamId, url) {
  await supabase.from('teams').update({ masterSheetUrl: url }).eq('id', teamId);
}

// ── Leads ──

async function getLeads(teamId) {
  const { data } = await supabase.from('leads').select('*').eq('teamId', teamId).order('id');
  return data || [];
}

async function getLeadById(teamId, leadId) {
  const { data } = await supabase.from('leads').select('*').eq('id', leadId).eq('teamId', teamId).limit(1).maybeSingle();
  return data || null;
}

async function addLeads(teamId, newLeads) {
  const today = new Date().toISOString().split('T')[0];
  const missingCols = await getMissingLeadCols();
  const { data: existing } = await supabase.from('leads').select('*').eq('teamId', teamId);
  const existingByContact = new Map((existing || []).map(l => [l.contact.replace(/\D/g, ''), l]));

  const toInsert = [];
  const toUpdate = [];
  for (const raw of newLeads) {
    const lead = smartCleanRow(raw);
    const contactKey = lead.contact.replace(/\D/g, '');
    const match = existingByContact.get(contactKey);
    if (match) {
      // Update existing record with corrected data
      const patch = {
        id: match.id,
        customerName: lead.customerName,
        contact: lead.contact,
        college: lead.college || '',
        branch: lead.branch || '',
        year: lead.year || '',
      };
      if (!missingCols.has('whatsapp')) patch.whatsapp = lead.whatsapp || '';
      toUpdate.push(patch);
    } else {
      const row = {
        teamId,
        customerName: lead.customerName,
        contact: lead.contact,
        college: lead.college || '',
        branch: lead.branch || '',
        year: lead.year || '',
        status: 'unassigned',
        naCount: 0,
        assignedInMaster: false,
        currentAssigneeId: null,
        createdAt: today,
        updatedAt: today,
      };
      if (!missingCols.has('whatsapp')) row.whatsapp = lead.whatsapp || '';
      if (!missingCols.has('sheetRow')) row.sheetRow = lead.sheetRow || null;
      toInsert.push(row);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('leads').insert(toInsert);
    if (error) throw error;
  }

  for (const upd of toUpdate) {
    const patch = {
      customerName: upd.customerName,
      contact: upd.contact,
      college: upd.college || '',
      branch: upd.branch || '',
      year: upd.year || '',
      updatedAt: today,
    };
    if (!missingCols.has('whatsapp')) patch.whatsapp = upd.whatsapp || '';
    const { error } = await supabase.from('leads').update(patch).eq('id', upd.id);
    if (error) console.error('Error updating lead', upd.id, error.message);
  }

  return { inserted: toInsert, updated: toUpdate.length };
}

async function updateLead(teamId, leadId, updates) {
  updates.updatedAt = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('leads').update(updates).eq('id', leadId).eq('teamId', teamId).select().limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// ── Lead Assignments ──

async function getAssignments(teamId) {
  const { data } = await supabase.from('lead_assignments').select('*').in('leadId',
    supabase.from('leads').select('id').eq('teamId', teamId)
  ).order('id', { ascending: false });
  return data || [];
}

async function addAssignment(teamId, entry) {
  const { error } = await supabase.from('lead_assignments').insert({
    leadId: entry.leadId,
    assignedTo: entry.assignedTo,
    assignedBy: entry.assignedBy || null,
    assignedDate: new Date().toISOString().split('T')[0],
    status: entry.status || null,
    remarks: entry.remarks || '',
  });
  if (error) throw error;
}

// ── BDA helpers ──

async function getActiveBdasForTeam(teamId) {
  return supabase
    .from('users')
    .select('id, name, email, phone')
    .eq('role', 'bda')
    .eq('teamId', teamId)
    .eq('status', 'active');
}

async function getPresentBdas(teamId) {
  const { data: bdas, error } = await getActiveBdasForTeam(teamId);
  if (error) throw error;
  if (!bdas || bdas.length === 0) return [];

  const today = new Date().toISOString().split('T')[0];
  const { data: absentBdas } = await supabase
    .from('leaves')
    .select('"employeeId"')
    .eq('status', 'Approved')
    .lte('fromDate', today)
    .gte('toDate', today);

  const absentIds = new Set((absentBdas || []).map(l => l.employeeId));
  return bdas.filter(b => !absentIds.has(b.id));
}

// ── Distribution ──

async function distributeLeads(teamId, assignedBy) {
  const { data: unassigned, error } = await supabase
    .from('leads')
    .select('*')
    .eq('teamId', teamId)
    .eq('status', 'unassigned')
    .order('id');

  if (error) throw error;
  if (!unassigned || unassigned.length === 0) return { distributed: 0, message: 'No unassigned leads' };

  const bdas = await getPresentBdas(teamId);
  if (bdas.length === 0) return { distributed: 0, message: 'No active BDAs present today' };

  // Filter out BDAs that already have uncompleted leads
  const bdaIds = bdas.map(b => b.id);
  const { data: pendingCounts } = await supabase
    .from('calling_sheet')
    .select('assignedUserId')
    .in('assignedUserId', bdaIds)
    .or('status.eq.,status.eq.Pending');

  const busyBdaIds = new Set((pendingCounts || []).map(r => r.assignedUserId));
  const availableBdas = bdas.filter(b => !busyBdaIds.has(b.id));

  if (availableBdas.length === 0) {
    return { distributed: 0, message: 'All BDAs have pending leads — complete them first.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const perBda = Math.floor(unassigned.length / availableBdas.length);
  let remainder = unassigned.length % availableBdas.length;
  let leadIdx = 0;

  for (const bda of availableBdas) {
    const count = perBda + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const batch = unassigned.slice(leadIdx, leadIdx + count);
    leadIdx += count;

    const ids = batch.map(l => l.id);
    if (ids.length === 0) continue;

    // Update leads status + assignee
    await supabase.from('leads').update({ status: 'assigned', currentAssigneeId: bda.id, updatedAt: today }).in('id', ids);

    // Only create calling_sheet rows for first 50 per BDA; rest stay inactive
    const activeBatch = batch.slice(0, 50);
    if (activeBatch.length > 0) {
      const sheetRows = activeBatch.map(l => ({
        assignedUserId: bda.id,
        leadId: l.id,
        customerName: l.customerName,
        contact: l.contact,
        whatsapp: l.whatsapp || '',
        college: l.college,
        branch: l.branch,
        year: l.year,
        status: '',
        naCount: 0,
        remarks: '',
        lastUpdated: today,
      }));
      await supabase.from('calling_sheet').insert(sheetRows);
    }

    // Assignment records
    const assignRows = batch.map(l => ({
      leadId: l.id,
      assignedTo: bda.id,
      assignedBy,
      assignedDate: today,
      status: null,
      remarks: '',
    }));
    await supabase.from('lead_assignments').insert(assignRows);
  }

  // Push to each BDA's Google Sheet
  try {
    const { pushBdaLeadsToSheet, extractSheetId } = require('./sheetsSync');
    for (const bda of availableBdas) {
      const { data: user } = await supabase.from('users').select('"assignedSheetUrl", "assignedSheetTab"').eq('id', bda.id).single();
      if (user?.assignedSheetUrl) {
        const sid = extractSheetId(user.assignedSheetUrl);
        await pushBdaLeadsToSheet(bda.id, sid, user.assignedSheetTab || 'Sheet1');
      }
    }
  } catch (pushErr) {
    console.error('Push to sheets error (non-fatal):', pushErr.message);
  }

  // Update master sheet with assignment info
  try {
    const masterSheetUrl = await getMasterSheetUrl(teamId);
    if (masterSheetUrl) {
      const { extractSheetId, updateMasterSheetAssignments, importLeadsFromMasterSheet } = require('./sheetsSync');
      const sheetId = extractSheetId(masterSheetUrl);
      const assignments = [];
      const needsRowMatch = []; // leads without sheetRow
      let tmpIdx = 0;
      let tmpRemainder = unassigned.length % availableBdas.length;
      const tmpPerBda = Math.floor(unassigned.length / availableBdas.length);
      for (const bda of availableBdas) {
        const count = tmpPerBda + (tmpRemainder > 0 ? 1 : 0);
        if (tmpRemainder > 0) tmpRemainder--;
        const batch = unassigned.slice(tmpIdx, tmpIdx + count);
        tmpIdx += count;
        for (const lead of batch) {
          if (lead.sheetRow) {
            assignments.push({ bdaName: bda.name, sheetRow: lead.sheetRow });
          } else {
            needsRowMatch.push({ lead, bdaName: bda.name });
          }
        }
      }
      // Match past leads (no sheetRow) by contact digits
      if (needsRowMatch.length > 0) {
        const sheetLeads = await importLeadsFromMasterSheet(sheetId);
        const contactToRow = {};
        for (const sl of sheetLeads) {
          if (sl.sheetRow) {
            const key = (sl.contact || '').replace(/\D/g, '');
            if (key) contactToRow[key] = sl.sheetRow;
          }
        }
        for (const item of needsRowMatch) {
          const key = (item.lead.contact || '').replace(/\D/g, '');
          if (contactToRow[key]) {
            assignments.push({ bdaName: item.bdaName, sheetRow: contactToRow[key] });
          }
        }
      }
      if (assignments.length > 0) {
        await updateMasterSheetAssignments(sheetId, 'Sheet1', assignments);
        await supabase.from('leads').update({ assignedInMaster: true }).in('id', unassigned.map(l => l.id));
      }
    }
  } catch (masterErr) {
    console.error('Master sheet update error (non-fatal):', masterErr.message);
  }

  return { distributed: leadIdx, message: `Distributed ${leadIdx} leads to ${availableBdas.length} BDAs (${bdas.length - availableBdas.length} skipped — have pending leads)` };
}

// ── NA Reassignment ──

async function reassignNaLeads(teamId, assignedBy) {
  const { data: naLeads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('teamId', teamId)
    .eq('status', 'na')
    .order('id');

  if (error) throw error;
  if (!naLeads || naLeads.length === 0) return { reassigned: 0, message: 'No NA leads to reassign' };

  const bdas = await getPresentBdas(teamId);
  if (bdas.length === 0) return { reassigned: 0, message: 'No active BDAs present today' };

  const today = new Date().toISOString().split('T')[0];
  let reassigned = 0;
  let dropped = 0;

  for (let i = 0; i < naLeads.length; i++) {
    const lead = naLeads[i];
    const newNaCount = (lead.naCount || 0) + 1;

    if (newNaCount >= 5) {
      await supabase.from('leads').update({ status: 'dropped', naCount: newNaCount, updatedAt: today }).eq('id', lead.id);
      await supabase.from('calling_sheet').delete().eq('leadId', lead.id);
      dropped++;
      continue;
    }

    // Pick next BDA avoiding same one
    let bdaIdx = i % bdas.length;
    let newBda = bdas[bdaIdx];
    if (newBda.id === lead.currentAssigneeId && bdas.length > 1) {
      bdaIdx = (bdaIdx + 1) % bdas.length;
      newBda = bdas[bdaIdx];
    }

    await supabase.from('leads').update({ status: 'assigned', naCount: newNaCount, currentAssigneeId: newBda.id, updatedAt: today }).eq('id', lead.id);

    // Delete old calling_sheet row
    await supabase.from('calling_sheet').delete().eq('leadId', lead.id);

    // Create new calling_sheet row
    await supabase.from('calling_sheet').insert({
      assignedUserId: newBda.id,
      leadId: lead.id,
      customerName: lead.customerName,
      contact: lead.contact,
      college: lead.college,
      branch: lead.branch,
      year: lead.year,
      status: '',
      naCount: newNaCount,
      remarks: '',
      lastUpdated: today,
    });

    // Assignment record
    await supabase.from('lead_assignments').insert({
      leadId: lead.id,
      assignedTo: newBda.id,
      assignedBy,
      assignedDate: today,
      status: null,
      remarks: `Reassigned (NA#${newNaCount})`,
    });

    reassigned++;
  }

  // Push updated sheets for affected BDAs
  try {
    const { pushBdaLeadsToSheet, extractSheetId } = require('./sheetsSync');
    const affectedIds = [...new Set([...naLeads.map(l => l.currentAssigneeId), ...bdas.map(b => b.id)].filter(Boolean))];
    for (const bdaId of affectedIds) {
      const { data: user } = await supabase.from('users').select('"assignedSheetUrl", "assignedSheetTab"').eq('id', bdaId).single();
      if (user?.assignedSheetUrl) {
        const sid = extractSheetId(user.assignedSheetUrl);
        await pushBdaLeadsToSheet(bdaId, sid, user.assignedSheetTab || 'Sheet1');
      }
    }
  } catch (pushErr) {
    console.error('Push to sheets error (non-fatal):', pushErr.message);
  }

  return { reassigned, dropped, message: `Reassigned ${reassigned}, dropped ${dropped} leads` };
}

module.exports = {
  getMasterSheetUrl,
  setMasterSheetUrl,
  getLeads,
  getLeadById,
  addLeads,
  updateLead,
  getAssignments,
  addAssignment,
  getActiveBdasForTeam,
  getPresentBdas,
  distributeLeads,
  reassignNaLeads,
};

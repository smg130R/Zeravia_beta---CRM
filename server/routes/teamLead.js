const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const teamLeadData = require('../services/teamLeadData');
const { pruneRows } = require('../services/columns');

// GET /api/team-lead/config - Get team's master sheet URL
router.get('/config', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });
    const url = await teamLeadData.getMasterSheetUrl(teamId);
    return res.json({ masterSheetUrl: url });
  } catch (error) {
    console.error('Get team config error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/team-lead/config - Set master sheet URL
router.put('/config', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });
    const { masterSheetUrl } = req.body;
    if (!masterSheetUrl) return res.status(400).json({ message: 'Master sheet URL is required.' });
    await teamLeadData.setMasterSheetUrl(teamId, masterSheetUrl);
    return res.json({ message: 'Master sheet URL saved.' });
  } catch (error) {
    console.error('Set team config error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/team-lead/import - Import leads from master Google Sheet
router.post('/import', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const masterSheetUrl = await teamLeadData.getMasterSheetUrl(teamId);
    if (!masterSheetUrl) {
      return res.status(400).json({ message: 'No master sheet URL configured. Save your sheet URL first.' });
    }

    const { extractSheetId, importLeadsFromMasterSheet } = require('../services/sheetsSync');
    const sheetId = extractSheetId(masterSheetUrl);
    const leads = await importLeadsFromMasterSheet(sheetId);

    if (leads.length === 0) {
      return res.status(400).json({ message: 'No leads found in the master sheet. Check the sheet has data starting from row 2 (Name, Contact, College, Branch, Year).' });
    }

    const result = await teamLeadData.addLeads(teamId, leads);
    const updated = result.updated || 0;
    return res.json({ message: `Imported ${result.inserted.length} new, updated ${updated} existing leads from master sheet.`, added: result.inserted.length, updated });
  } catch (error) {
    console.error('Import leads error:', error);
    return res.status(500).json({ message: 'Error reading master sheet: ' + error.message });
  }
});

// GET /api/team-lead/sheets-check - Diagnose Google Sheets auth + master sheet read
router.get('/sheets-check', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const { google } = require('googleapis');
    const { normalizePrivateKey, extractSheetId, importLeadsFromMasterSheet } = require('../services/sheetsSync');

    const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    const hasEmail = !!saEmail;
    const hasKey = !!rawKey;

    let authOk = false;
    let authError = null;
    let keyPreview = null;
    if (hasKey) {
      try {
        const key = normalizePrivateKey(rawKey);
        keyPreview = String(key).slice(0, 30) + '...';
        const auth = new google.auth.JWT({ email: saEmail, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        await auth.authorize();
        authOk = true;
      } catch (e) {
        authError = e.message;
      }
    } else {
      authError = 'GOOGLE_PRIVATE_KEY is not set';
    }

    let masterSheetUrl = null;
    if (teamId) masterSheetUrl = await teamLeadData.getMasterSheetUrl(teamId);

    let sheetReadOk = false;
    let rowsFound = 0;
    let sheetReadError = null;
    if (authOk && masterSheetUrl) {
      try {
        const sheetId = extractSheetId(masterSheetUrl);
        const leads = await importLeadsFromMasterSheet(sheetId);
        sheetReadOk = true;
        rowsFound = leads.length;
      } catch (e) {
        sheetReadError = e.message;
      }
    }

    return res.json({
      teamId,
      serviceAccount: { email: saEmail || null, hasEmail, hasKey, keyPreview, authOk, authError },
      masterSheet: { url: masterSheetUrl, sheetReadOk, rowsFound, sheetReadError },
      tip: !hasKey
        ? 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in server .env / Render env vars.'
        : !authOk
          ? 'Service account auth failed — check the private key value and that the account still exists.'
          : !masterSheetUrl
            ? 'No master sheet URL configured for this team.'
            : sheetReadOk
              ? 'Google Sheets connection is working.'
              : 'Auth OK but reading the sheet failed — share the sheet with ' + (saEmail || 'the service account') + ' as Editor.',
    });
  } catch (error) {
    console.error('Sheets diagnostic error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


router.post('/deduplicate', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const { data: leads } = await supabase.from('leads').select('*').eq('teamId', teamId).order('id', { ascending: false });
    if (!leads || leads.length === 0) return res.json({ message: 'No leads to deduplicate.', removed: 0 });

    const byContact = {};
    for (const lead of leads) {
      const key = lead.contact.replace(/\D/g, '');
      if (!key) continue;
      if (!byContact[key]) byContact[key] = [];
      byContact[key].push(lead);
    }

    const toDelete = [];
    const reassigns = [];
    for (const [contact, group] of Object.entries(byContact)) {
      if (group.length <= 1) continue;
      // Keep first (highest ID = latest imported), delete rest
      const [keep, ...dupes] = group;
      for (const d of dupes) {
        reassigns.push({ oldId: d.id, newId: keep.id });
        toDelete.push(d.id);
      }
    }

    if (toDelete.length === 0) {
      return res.json({ message: 'No duplicates found.', removed: 0 });
    }

    // Update calling_sheet references to point to surviving leads
    for (const r of reassigns) {
      await supabase.from('calling_sheet').update({ leadId: r.newId }).eq('leadId', r.oldId);
    }

    // Delete duplicate leads
    const { error } = await supabase.from('leads').delete().in('id', toDelete);
    if (error) throw error;

    return res.json({
      message: `Removed ${toDelete.length} duplicate leads, reassigned ${reassigns.length} calling sheet references.`,
      removed: toDelete.length,
    });
  } catch (error) {
    console.error('Deduplicate error:', error);
    return res.status(500).json({ message: 'Error deduplicating: ' + error.message });
  }
});

// GET /api/team-lead/leads - Get all leads for the team
router.get('/leads', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });
    const leads = await teamLeadData.getLeads(teamId);

    // Enrich with BDA names
    const assigneeIds = [...new Set(leads.filter(l => l.currentAssigneeId).map(l => l.currentAssigneeId))];
    let bdaMap = {};
    if (assigneeIds.length > 0) {
      const { data: bdas } = await supabase.from('users').select('id, name').in('id', assigneeIds);
      bdaMap = Object.fromEntries((bdas || []).map(b => [b.id, b.name]));
    }

    const enriched = leads.map(l => ({
      ...l,
      assigneeName: bdaMap[l.currentAssigneeId] || null,
    }));

    return res.json({ leads: enriched, total: enriched.length });
  } catch (error) {
    console.error('Get leads error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/team-lead/distribute - Distribute leads to present BDAs
router.post('/distribute', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const result = await teamLeadData.distributeLeads(teamId, req.user.id);
    return res.json(result);
  } catch (error) {
    console.error('Distribute leads error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/team-lead/reassign-na - Reassign NA leads to other BDAs
router.post('/reassign-na', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const result = await teamLeadData.reassignNaLeads(teamId, req.user.id);
    return res.json(result);
  } catch (error) {
    console.error('Reassign NA leads error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/team-lead/assign-selected - Manually assign selected leads to a specific BDA
router.post('/assign-selected', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const { leadIds, bdaId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one lead to assign.' });
    }
    if (!bdaId) {
      return res.status(400).json({ message: 'Select a BDA to assign to.' });
    }

    // Verify BDA exists and belongs to the team
    const { data: bda } = await supabase.from('users').select('id, name').eq('id', bdaId).eq('teamId', teamId).eq('role', 'bda').single();
    if (!bda) {
      return res.status(400).json({ message: 'Invalid BDA selected.' });
    }

    // Verify leads belong to the team and are unassigned
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('teamId', teamId)
      .eq('status', 'unassigned')
      .in('id', leadIds);

    if (!leads || leads.length === 0) {
      return res.status(400).json({ message: 'No valid unassigned leads found for the selected IDs.' });
    }

    const validIds = leads.map(l => l.id);
    const today = new Date().toISOString().split('T')[0];

    // Update leads
    await supabase.from('leads').update({ status: 'assigned', currentAssigneeId: bdaId, updatedAt: today }).in('id', validIds);

    // Count how many active calling_sheet entries the BDA already has
    const { data: activeEntries } = await supabase
      .from('calling_sheet')
      .select('id')
      .eq('assignedUserId', bdaId)
      .or('status.eq.,status.eq.Pending');
    const activeCount = (activeEntries || []).length;
    const slotAvailable = Math.max(0, 50 - activeCount);

    // Only create calling_sheet rows up to the available slot
    const toActivate = slotAvailable > 0 ? leads.slice(0, slotAvailable) : [];

    // The rest stay assigned but inactive
    if (toActivate.length < leads.length) {
      const inactiveIds = leads.slice(toActivate.length).map(l => l.id);
      // They stay with status='assigned' in leads table
      if (inactiveIds.length > 0) {
        console.log(`BDA ${bdaId}: ${inactiveIds.length} leads kept inactive (no calling_sheet yet)`);
      }
    }

    if (toActivate.length > 0) {
      const sheetRows = toActivate.map(l => ({
        assignedUserId: bdaId,
        leadId: l.id,
        customerName: l.customerName,
        contact: l.contact,
        whatsapp: l.whatsapp || '',
        college: l.college,
        branch: l.branch,
        year: l.year,
        status: '',
        naCount: l.naCount || 0,
        remarks: '',
        lastUpdated: today,
      }));
      await supabase.from('calling_sheet').insert(await pruneRows(sheetRows, 'calling_sheet', ['whatsapp', 'followUpDate', 'priority']));
    }

    // Assignment records
    const assignRows = leads.map(l => ({
      leadId: l.id,
      assignedTo: bdaId,
      assignedBy: req.user.id,
      assignedDate: today,
      status: null,
      remarks: '',
    }));
    await supabase.from('lead_assignments').insert(assignRows);

    // Update master sheet
    try {
      const masterSheetUrl = await teamLeadData.getMasterSheetUrl(teamId);
      if (masterSheetUrl) {
        const { extractSheetId, updateMasterSheetAssignments } = require('../services/sheetsSync');
        const sheetId = extractSheetId(masterSheetUrl);
        const assignments = leads.filter(l => l.sheetRow).map(l => ({ bdaName: bda.name, sheetRow: l.sheetRow }));
        const needsRowMatch = leads.filter(l => !l.sheetRow);
        if (needsRowMatch.length > 0) {
          const { importLeadsFromMasterSheet } = require('../services/sheetsSync');
          const sheetLeads = await importLeadsFromMasterSheet(sheetId);
          const contactToRow = {};
          for (const sl of sheetLeads) {
            if (sl.sheetRow) {
              const key = (sl.contact || '').replace(/\D/g, '');
              if (key) contactToRow[key] = sl.sheetRow;
            }
          }
          for (const l of needsRowMatch) {
            const key = (l.contact || '').replace(/\D/g, '');
            if (contactToRow[key]) {
              assignments.push({ bdaName: bda.name, sheetRow: contactToRow[key] });
            }
          }
        }
        if (assignments.length > 0) {
          await updateMasterSheetAssignments(sheetId, 'Sheet1', assignments);
        }
        await supabase.from('leads').update({ assignedInMaster: true }).in('id', validIds);
      }
    } catch (masterErr) {
      console.error('Master sheet update error (non-fatal):', masterErr.message);
    }

    return res.json({ message: `Assigned ${validIds.length} lead(s) to ${bda.name}.`, count: validIds.length });
  } catch (error) {
    console.error('Assign selected leads error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/team-lead/assignments - Get assignment history
router.get('/assignments', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const assignments = await teamLeadData.getAssignments(teamId);

    // Enrich with names
    const userIds = [...new Set(assignments.flatMap(a => [a.assignedTo, a.assignedBy].filter(Boolean)))];
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      userMap = Object.fromEntries((users || []).map(u => [u.id, u.name]));
    }

    const enriched = assignments.map(a => ({
      ...a,
      assigneeName: userMap[a.assignedTo] || null,
      assignerName: userMap[a.assignedBy] || null,
    }));

    return res.json({ assignments: enriched });
  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/team-lead/bdas - Get active BDAs in team
router.get('/bdas', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const bdas = await teamLeadData.getPresentBdas(teamId);
    return res.json({ bdas, presentCount: bdas.length });
  } catch (error) {
    console.error('Get BDAs error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/team-lead/bdas-with-sheets - Get BDAs with their sheet URLs
router.get('/bdas-with-sheets', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const { data: bdas } = await supabase
      .from('users')
      .select('id, name, email, "assignedSheetUrl", "prospectSheetUrl", "assignedSheetTab", "prospectSheetTab"')
      .eq('role', 'bda')
      .eq('teamId', teamId)
      .eq('status', 'active')
      .order('name');

    return res.json({ bdas: bdas || [] });
  } catch (error) {
    console.error('Get BDAs with sheets error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/team-lead/bda-sheets/:bdaId - Team lead sets BDA sheet URLs
router.patch('/bda-sheets/:bdaId', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.status(400).json({ message: 'You are not assigned to a team.' });

    const { bdaId } = req.params;
    const { assignedSheetUrl, prospectSheetUrl, assignedSheetTab, prospectSheetTab } = req.body;

    // Verify BDA is in TL's team
    const { data: bda } = await supabase.from('users').select('id, teamId').eq('id', bdaId).eq('role', 'bda').single();
    if (!bda || bda.teamId !== teamId) {
      return res.status(403).json({ message: 'BDA not found in your team.' });
    }

    const updates = {};
    if (assignedSheetUrl !== undefined) updates.assignedSheetUrl = assignedSheetUrl;
    if (prospectSheetUrl !== undefined) updates.prospectSheetUrl = prospectSheetUrl;
    if (assignedSheetTab !== undefined) updates.assignedSheetTab = assignedSheetTab;
    if (prospectSheetTab !== undefined) updates.prospectSheetTab = prospectSheetTab;

    await supabase.from('users').update(updates).eq('id', bdaId);
    return res.json({ message: 'BDA sheet config updated.' });
  } catch (error) {
    console.error('Set BDA sheets error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/team-lead/unassigned-count - Count fresh/unassigned leads for the team
router.get('/unassigned-count', authenticateToken, requireRoles(['team_lead', 'admin', 'ops_head']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) return res.json({ count: 0 });
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('teamId', teamId)
      .eq('status', 'unassigned');
    if (error) throw error;
    return res.json({ count: count || 0 });
  } catch (error) {
    console.error('Unassigned count error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

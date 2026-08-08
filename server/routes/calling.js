const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const { smartCleanRow } = require('../services/smartClean');
const { pruneRow, pruneRows } = require('../services/columns');

// GET /api/calling - Get BDA's own calling sheet (with smart field cleanup)
router.get('/', authenticateToken, requireRoles(['bda']), async (req, res) => {
  try {
    const { data: list, error } = await supabase
      .from('calling_sheet')
      .select('*')
      .eq('assignedUserId', req.user.id)
      .neq('status', 'Removed')
      .order('id', { ascending: true });

    if (error) throw error;
    const cleaned = (list || []).map(smartCleanRow);
    return res.json({ callingSheet: cleaned });
  } catch (error) {
    console.error('Get calling sheet error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/calling/team - Team lead views calling sheets of BDAs in their team
router.get('/team', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(400).json({ message: 'You are not assigned to a team.' });
    }

    const { bdaId } = req.query;
    const { data: bdas } = await supabase
      .from('users')
      .select('id, name')
      .eq('teamId', teamId)
      .eq('role', 'bda');

    if (!bdas || bdas.length === 0) {
      return res.json({ callingSheets: [], bdas: [] });
    }

    let bdaIds = bdas.map(b => b.id);
    if (bdaId && bdaIds.includes(Number(bdaId))) {
      bdaIds = [Number(bdaId)];
    }

    const { data: sheets, error } = await supabase
      .from('calling_sheet')
      .select('*')
      .in('assignedUserId', bdaIds)
      .neq('status', 'Removed')
      .order('id', { ascending: true });

    if (error) throw error;

    const bdaMap = Object.fromEntries(bdas.map(b => [b.id, b.name]));
    const enriched = (sheets || []).map(row => ({
      ...row,
      bdaName: bdaMap[row.assignedUserId] || `BDA #${row.assignedUserId}`,
    }));

    const cleaned = enriched.map(smartCleanRow);

    return res.json({ callingSheets: cleaned, bdas });
  } catch (error) {
    console.error('Get team calling sheets error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/calling/:id - Team lead removes a calling sheet entry (marks as Removed, resets lead to unassigned)
router.delete('/:id', authenticateToken, requireRoles(['team_lead', 'admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('calling_sheet')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !row) {
      return res.status(404).json({ message: 'Calling sheet entry not found.' });
    }

    const bdaId = row.assignedUserId;

    const { error: updateErr } = await supabase
      .from('calling_sheet')
      .update({ status: 'Removed', lastUpdated: new Date().toISOString().split('T')[0] })
      .eq('id', id);

    if (updateErr) throw updateErr;

    if (row.leadId && req.user.teamId) {
      const { error: leadErr } = await supabase
        .from('leads')
        .update({ status: 'unassigned', currentAssigneeId: null, updatedAt: new Date().toISOString().split('T')[0] })
        .eq('id', row.leadId);
      if (leadErr) console.error('Lead reset error (non-fatal):', leadErr.message);
    }

    // Mark as "Deleted" in the BDA's Google Sheet (targeted cell update)
    try {
      const { data: bdaUser } = await supabase
        .from('users')
        .select('"assignedSheetUrl", "assignedSheetTab"')
        .eq('id', bdaId)
        .single();
      if (bdaUser?.assignedSheetUrl) {
        const { markBdaSheetRowDeleted, extractSheetId } = require('../services/sheetsSync');
        const sid = extractSheetId(bdaUser.assignedSheetUrl);
        await markBdaSheetRowDeleted(sid, bdaUser.assignedSheetTab || 'Sheet1', row.customerName, row.contact);
      }
    } catch (sheetErr) {
      console.error('BDA sheet cell update error (non-fatal):', sheetErr.message);
    }

    return res.json({ message: 'Calling sheet entry marked as Removed and lead reset to unassigned.' });
  } catch (error) {
    console.error('Delete calling sheet entry error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/calling/:id - Update status and remarks + Recalculate KPIs
router.patch('/:id', authenticateToken, requireRoles(['bda']), async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required.' });
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Get existing customer record
    const { data: customer, error: fetchErr } = await supabase
      .from('calling_sheet')
      .select('*')
      .eq('id', id)
      .eq('assignedUserId', req.user.id)
      .single();
    
    if (fetchErr || !customer) {
      return res.status(404).json({ message: 'Customer record not found or unauthorized.' });
    }

    // Apply smart cleanup so lead matching uses corrected fields
    const cleanCustomer = smartCleanRow(customer);

    // Calculate follow-up date
    const isFollowUp = status === 'Follow-up';
    const isNoAnswer = status === 'No Answer';
    const wasFollowUp = customer.status === 'Follow-up';
    let followUpDate = null;
    if (isFollowUp) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      followUpDate = tomorrow.toISOString().split('T')[0];
    } else if (isNoAnswer && wasFollowUp) {
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      followUpDate = nextDay.toISOString().split('T')[0];
    }

    const updateFields = { status, remarks: remarks || '', lastUpdated: todayStr };
    if (isFollowUp || (isNoAnswer && wasFollowUp)) {
      updateFields.followUpDate = followUpDate;
    } else if (wasFollowUp || customer.followUpDate) {
      updateFields.followUpDate = null;
    }
    await supabase
      .from('calling_sheet')
      .update(await pruneRow(updateFields, 'calling_sheet', ['followUpDate', 'priority', 'whatsapp']))
      .eq('id', id);

    // Sync status and remarks back to leads table
    if (req.user.teamId) {
      try {
        const teamLeadData = require('../services/teamLeadData');
        const leads = await teamLeadData.getLeads(req.user.teamId);
        const match = leads.find(l =>
          l.customerName === cleanCustomer.customerName && l.contact === cleanCustomer.contact
        );
        if (match) {
          const mappedStatus = status.toLowerCase().replace(/\s+/g, '_');
          const leadUpdates = { status: mappedStatus, updatedAt: todayStr };
          if (remarks) leadUpdates.remarks = remarks;
          await teamLeadData.updateLead(req.user.teamId, match.id, leadUpdates);
          await teamLeadData.addAssignment(req.user.teamId, {
            leadId: match.id, assignedTo: req.user.id, assignedBy: req.user.id,
            status: mappedStatus, remarks: remarks || ''
          });
          if (['form_shared', 'screenshot_shared'].includes(mappedStatus)) {
            await teamLeadData.updateLead(req.user.teamId, match.id, { assignedInMaster: true });
          }

          // Push status back to master Google Sheet
          try {
            const masterSheetUrl = await teamLeadData.getMasterSheetUrl(req.user.teamId);
            if (masterSheetUrl) {
              const { extractSheetId, updateMasterSheetStatus } = require('../services/sheetsSync');
              const sheetId = extractSheetId(masterSheetUrl);
              if (sheetId && match.sheetRow) {
                await updateMasterSheetStatus(sheetId, 'Sheet1', match.sheetRow, status, remarks || '');
              }
            }
          } catch (sheetErr) {
            console.error('Master sheet update error (non-fatal):', sheetErr.message);
          }
        }
      } catch (syncErr) {
        console.error('Team lead data sync error (non-fatal):', syncErr.message);
      }
    }

    // Recalculate KPIs for this BDA for today
    const { data: allRecords, error: recordsErr } = await supabase
      .from('calling_sheet')
      .select('status')
      .eq('assignedUserId', req.user.id);

    if (recordsErr) throw recordsErr;
    
    let callsCount = 0;
    let connectsCount = 0;
    let prospectsCount = 0;
    let dealsCount = 0;
    let followupsCount = 0;

    const connectStatuses = ['Connected', 'Interested', 'NI', 'FORM SHARED', 'SCREENSHOT SHARED', 'NOT YET REPLIED', 'CALL BACK', 'RESPONDED', 'Deal Closed'];
    (allRecords || []).forEach(rec => {
      const s = rec.status;
      if (s === 'Removed' || s === 'Pending' || s === 'unassigned' || !s) return;
      callsCount++;
      if (connectStatuses.includes(s)) connectsCount++;
      if (s === 'Interested') prospectsCount++;
      if (s === 'Deal Closed') dealsCount++;
      if (s === 'Follow-up') followupsCount++;
    });

    // Determine time slot: MC1 (11-2), MC2 (3:15-5)
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const inSlot1 = currentHour >= 11 && currentHour < 14;
    const inSlot2 = currentHour >= 15.25 && currentHour < 17;

    // Get today's KPI record
    const { data: kpi, error: kpiErr } = await supabase
      .from('kpi_records')
      .select('*')
      .eq('userId', req.user.id)
      .eq('date', todayStr)
      .single();

    if (kpiErr && kpiErr.code !== 'PGRST116') throw kpiErr;

    // eSS is Sales Calls — only modified by track-sales-call, never by this endpoint
    const eSS = kpi ? kpi.eSS : 0;
    let mCalls = kpi ? kpi.mCalls : 0;
    let mConn = kpi ? kpi.mConn : 0;
    let mSS = kpi ? kpi.mSS : 0;
    let mPros = kpi ? kpi.mPros : 0;
    let eCalls = kpi ? kpi.eCalls : 0;
    let eConn = kpi ? kpi.eConn : 0;
    let ePros = kpi ? kpi.ePros : 0;

    if (!kpi) {
      if (inSlot1) {
        mCalls = callsCount;
        mConn = connectsCount;
        mPros = prospectsCount;
      } else if (inSlot2) {
        eCalls = callsCount;
        eConn = connectsCount;
        ePros = prospectsCount;
      } else {
        // After 5 PM — calls still count as MC2 (evening slot)
        eCalls = callsCount;
        eConn = connectsCount;
        ePros = prospectsCount;
      }
    } else {
      if (inSlot1) {
        mCalls = Math.max(callsCount - eCalls, 0);
        mConn = Math.max(connectsCount - eConn, 0);
        mPros = prospectsCount;
      } else if (inSlot2) {
        eCalls = Math.max(callsCount - mCalls, 0);
        eConn = Math.max(connectsCount - mConn, 0);
        ePros = prospectsCount;
      } else {
        // After 5 PM — all calls count as MC2
        eCalls = Math.max(callsCount - mCalls, 0);
        eConn = Math.max(connectsCount - mConn, 0);
        ePros = prospectsCount;
      }
    }

    // Track screenshots
    const screenshotsCount = (allRecords || []).filter(r => r.status === 'SCREENSHOT SHARED').length;
    mSS = Math.max(screenshotsCount, kpi?.mSS || 0);

    const totalCalls = mCalls + eCalls;
    const totalConn = mConn + eConn;
    let perfScore = totalCalls > 0 ? parseFloat(((totalConn / totalCalls) * 60 + (dealsCount * 20)).toFixed(2)) : 0;
    if (perfScore > 100) perfScore = 100;

    if (!kpi) {
      const { error: insertErr } = await supabase
        .from('kpi_records')
        .insert({
          userId: req.user.id,
          date: todayStr,
          mCalls, mConn, mSS, mPros,
          eCalls, eConn, eSS, ePros,
          deals: dealsCount,
          followups: followupsCount,
          perfScore
        });

      if (insertErr) throw insertErr;
    } else {
      const { error: updateKpiErr } = await supabase
        .from('kpi_records')
        .update({
          mCalls, mConn, mSS, mPros,
          eCalls, eConn, eSS, ePros,
          deals: dealsCount,
          followups: followupsCount,
          perfScore
        })
        .eq('userId', req.user.id)
        .eq('date', todayStr);

      if (updateKpiErr) throw updateKpiErr;
    }

    return res.json({ 
      message: 'Calling sheet and KPI updated successfully', 
      customer: { ...customer, status, remarks, lastUpdated: todayStr } 
    });
  } catch (error) {
    console.error('Update calling sheet row error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/calling/fetch-leads - BDA fetches next batch (up to 50) from assigned pool or team pool
router.post('/fetch-leads', authenticateToken, requireRoles(['bda']), async (req, res) => {
  try {
    const bdaId = req.user.id;
    const teamId = req.user.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'You are not assigned to a team.' });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Delete completed calling_sheet entries (status not blank and not Pending)
    const { data: completed, error: delErr } = await supabase
      .from('calling_sheet')
      .select('id')
      .eq('assignedUserId', bdaId)
      .not('status', 'in', '("","Pending")');
    if (delErr) throw delErr;
    const completedIds = (completed || []).map(r => r.id);
    if (completedIds.length > 0) {
      await supabase.from('calling_sheet').delete().in('id', completedIds);
    }

    // 2. Count remaining active (blank/Pending) calling sheet entries
    const { data: activeEntries } = await supabase
      .from('calling_sheet')
      .select('id')
      .eq('assignedUserId', bdaId)
      .or('status.eq.,status.eq.Pending');
    const activeCount = (activeEntries || []).length;

    if (activeCount >= 50) {
      return res.status(400).json({ message: `You already have ${activeCount} active leads. Complete them first.`, count: 0 });
    }

    const slotsLeft = 50 - activeCount;
    let activated = 0;

    // 3. Try to activate "inactive" assigned leads (leads assigned to BDA but not yet in calling_sheet)
    const { data: inactiveLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('teamId', teamId)
      .eq('currentAssigneeId', bdaId)
      .eq('status', 'assigned');

    // Filter: those without a calling_sheet entry for this BDA
    const inactiveToActivate = [];
    if (inactiveLeads && inactiveLeads.length > 0) {
      const inactiveLeadIds = inactiveLeads.map(l => l.id);
      const { data: existingSheet } = await supabase
        .from('calling_sheet')
        .select('leadId')
        .eq('assignedUserId', bdaId)
        .in('leadId', inactiveLeadIds);
      const existingSet = new Set((existingSheet || []).map(r => r.leadId));
      for (const lead of inactiveLeads) {
        if (!existingSet.has(lead.id) && inactiveToActivate.length < slotsLeft) {
          inactiveToActivate.push(lead);
        }
      }
    }

    if (inactiveToActivate.length > 0) {
      const sheetRows = inactiveToActivate.map(lead => ({
        assignedUserId: bdaId,
        leadId: lead.id,
        customerName: lead.customerName,
        contact: lead.contact,
        whatsapp: lead.whatsapp || '',
        college: lead.college || '',
        branch: lead.branch || '',
        year: lead.year || '',
        status: '',
        naCount: lead.naCount || 0,
        remarks: '',
        lastUpdated: today,
      }));
      await supabase.from('calling_sheet').insert(await pruneRows(sheetRows, 'calling_sheet', ['whatsapp', 'followUpDate', 'priority']));
      activated += inactiveToActivate.length;
    }

    // 4. If still have slots, fetch new from unassigned pool
    let fetchedFromPool = 0;
    const remainingSlots = slotsLeft - activated;

    if (remainingSlots > 0) {
      const { data: unassigned, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('teamId', teamId)
        .eq('status', 'unassigned')
        .order('id')
        .limit(remainingSlots);

      if (!fetchError && unassigned && unassigned.length > 0) {
        const leadIds = unassigned.map(l => l.id);

        await supabase.from('leads').update({ status: 'assigned', currentAssigneeId: bdaId, updatedAt: today }).in('id', leadIds);

        const cleanLeads = unassigned.map(lead => smartCleanRow(lead));

        const callingEntries = cleanLeads.map(lead => ({
          assignedUserId: bdaId,
          leadId: lead.id,
          customerName: lead.customerName,
          contact: lead.contact,
          whatsapp: lead.whatsapp || '',
          college: lead.college || '',
          branch: lead.branch || '',
          year: lead.year || '',
          status: '',
          naCount: lead.naCount || 0,
          remarks: '',
          lastUpdated: today,
        }));

        await supabase.from('calling_sheet').insert(await pruneRows(callingEntries, 'calling_sheet', ['whatsapp', 'followUpDate', 'priority']));
        fetchedFromPool = unassigned.length;

        // Update master sheet
        try {
          const { data: team } = await supabase.from('teams').select('"masterSheetUrl"').eq('id', teamId).single();
          if (team?.masterSheetUrl) {
            const { extractSheetId, updateMasterSheetAssignments, importLeadsFromMasterSheet } = require('../services/sheetsSync');
            const sheetId = extractSheetId(team.masterSheetUrl);
            const bdaName = req.user.name || `BDA ${req.user.id}`;
            const assignments = [];
            const needsRowMatch = [];
            for (const l of cleanLeads) {
              if (l.sheetRow) {
                assignments.push({ bdaName, sheetRow: l.sheetRow });
              } else {
                needsRowMatch.push(l);
              }
            }
            if (needsRowMatch.length > 0) {
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
                  assignments.push({ bdaName, sheetRow: contactToRow[key] });
                }
              }
            }
            if (assignments.length > 0) {
              await updateMasterSheetAssignments(sheetId, 'Sheet1', assignments);
              await supabase.from('leads').update({ assignedInMaster: true }).in('id', leadIds);
            }
          }
        } catch (masterErr) {
          console.error('Master sheet update error (non-fatal):', masterErr.message);
        }
      }
    }

    const totalActivated = activated + fetchedFromPool;

    let msg;
    if (fetchedFromPool > 0) {
      msg = `Activated ${activated} inactive lead(s) + fetched ${fetchedFromPool} new lead(s).`;
    } else if (activated > 0) {
      msg = `Activated ${activated} lead(s) from your assigned pool.`;
    } else {
      msg = 'No new leads available right now.';
    }

    return res.json({ message: msg, count: totalActivated });
  } catch (error) {
    console.error('Fetch leads error:', error);
    return res.status(500).json({ message: 'Error fetching leads: ' + error.message });
  }
});

// POST /api/calling/fix-data - Permanently fix swapped fields in existing calling sheet & leads
router.post('/fix-data', authenticateToken, requireRoles(['bda', 'team_lead', 'admin']), async (req, res) => {
  try {
    const targetUserId = req.user.role === 'bda' ? req.user.id : (req.body.userId || req.user.id);
    const today = new Date().toISOString().split('T')[0];
    let fixedCalling = 0;
    let fixedLeads = 0;

    // Fix calling_sheet for this user
    const { data: callingRows } = await supabase
      .from('calling_sheet')
      .select('*')
      .eq('assignedUserId', targetUserId);

    const fixLog = [];
    if (callingRows) {
      // Batch-fetch leads for these calling sheet rows
      const leadIds = [...new Set(callingRows.filter(r => r.leadId).map(r => r.leadId))];
      let leadMap = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabase.from('leads').select('id, "customerName", contact, college, branch, year').in('id', leadIds);
        leadMap = Object.fromEntries((leads || []).map(l => [l.id, l]));
      }

      for (const row of callingRows) {
        // Step 1: Sync data fields from lead (source of truth)
        const baseRow = { ...row };
        const lead = row.leadId ? leadMap[row.leadId] : null;
        if (lead) {
          baseRow.customerName = lead.customerName;
          baseRow.contact = lead.contact;
          baseRow.college = lead.college || '';
          baseRow.branch = lead.branch || '';
          baseRow.year = lead.year || '';
        }

        // Step 2: Run smartClean on synced data
        const cleaned = smartCleanRow(baseRow);
        const changed = cleaned.customerName !== row.customerName
          || cleaned.contact !== row.contact
          || cleaned.college !== (row.college || '')
          || cleaned.branch !== (row.branch || '')
          || cleaned.year !== (row.year || '');
        if (changed) {
          const diff = {};
          for (const f of ['customerName', 'contact', 'college', 'branch', 'year']) {
            if (cleaned[f] !== (row[f] || '')) diff[f] = { from: row[f] || '', to: cleaned[f] || '' };
          }
          fixLog.push({ id: row.id, table: 'calling_sheet', diff });
          await supabase.from('calling_sheet').update({
            customerName: cleaned.customerName,
            contact: cleaned.contact,
            college: cleaned.college || '',
            branch: cleaned.branch || '',
            year: cleaned.year || '',
            lastUpdated: today,
          }).eq('id', row.id);
          fixedCalling++;
        }
      }
    }

    // Fix leads table (same user's assigned leads or team-wide for team_lead/admin)
    let leadQuery = supabase.from('leads').select('*');
    if (req.user.role === 'bda') {
      leadQuery = leadQuery.eq('currentAssigneeId', targetUserId);
    } else if (req.user.teamId) {
      leadQuery = leadQuery.eq('teamId', req.user.teamId);
    }
    const { data: leadRows } = await leadQuery;

    if (leadRows) {
      for (const row of leadRows) {
        const cleaned = smartCleanRow({ ...row });
        const changed = cleaned.customerName !== row.customerName
          || cleaned.contact !== row.contact
          || cleaned.college !== (row.college || '')
          || cleaned.branch !== (row.branch || '')
          || cleaned.year !== (row.year || '');
        if (changed) {
          const diff = {};
          for (const f of ['customerName', 'contact', 'college', 'branch', 'year']) {
            if (cleaned[f] !== (row[f] || '')) diff[f] = { from: row[f] || '', to: cleaned[f] || '' };
          }
          fixLog.push({ id: row.id, table: 'leads', diff });
          await supabase.from('leads').update({
            customerName: cleaned.customerName,
            contact: cleaned.contact,
            college: cleaned.college || '',
            branch: cleaned.branch || '',
            year: cleaned.year || '',
            updatedAt: today,
          }).eq('id', row.id);
          fixedLeads++;
        }
      }
    }

    return res.json({
      message: `Fixed ${fixedCalling} calling sheet records and ${fixedLeads} leads.`,
      fixedCalling,
      fixedLeads,
      changes: fixLog.slice(0, 20),
    });
  } catch (error) {
    console.error('Fix data error:', error);
    return res.status(500).json({ message: 'Error fixing data: ' + error.message });
  }
});

// GET /api/calling/follow-ups - Get calling sheet records with follow-ups
router.get('/follow-ups', authenticateToken, requireRoles(['bda', 'team_lead', 'admin', 'hr']), async (req, res) => {
  try {
    let query = supabase.from('calling_sheet').select('*').neq('status', 'Removed');
    if (req.user.role === 'bda') {
      query = query.eq('assignedUserId', req.user.id);
    } else if (req.user.role === 'team_lead' || req.user.role === 'hr') {
      const { data: bdas } = await supabase.from('users').select('id').eq('teamId', req.user.teamId).eq('role', 'bda');
      const bdaIds = (bdas || []).map(b => b.id);
      if (bdaIds.length > 0) query = query.in('assignedUserId', bdaIds);
      else return res.json({ followUps: [] });
    }

    const { data: list } = await query.not('followUpDate', 'is', null).order('followUpDate', { ascending: true });

    const today = new Date().toISOString().split('T')[0];
    const followUps = (list || []).map(row => ({
      ...row,
      isMissed: row.followUpDate < today,
    }));

    return res.json({ followUps });
  } catch (error) {
    console.error('Follow-ups error:', error);
    return res.status(500).json({ message: 'Error fetching follow-ups: ' + error.message });
  }
});

// GET /api/calling/missed-report - Missed follow-ups per BDA (HR/Admin)
router.get('/missed-report', authenticateToken, requireRoles(['hr', 'admin', 'team_lead']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('calling_sheet').select('id, "assignedUserId", status, "followUpDate", "customerName", "lastUpdated"').neq('status', 'Removed');

    if (req.user.role === 'team_lead' || req.user.role === 'hr') {
      const { data: bdas } = await supabase.from('users').select('id, name').eq('teamId', req.user.teamId).eq('role', 'bda');
      const bdaIds = (bdas || []).map(b => b.id);
      if (bdaIds.length > 0) query = query.in('assignedUserId', bdaIds);
      else return res.json({ report: [] });
    }

    const { data: rows } = await query.lt('followUpDate', today).not('status', 'eq', 'Completed');

    const byBda = {};
    for (const row of rows || []) {
      if (!byBda[row.assignedUserId]) byBda[row.assignedUserId] = { missed: 0, leads: [] };
      byBda[row.assignedUserId].missed++;
      byBda[row.assignedUserId].leads.push(row.customerName);
    }

    // Enrich with BDA names
    const bdaIds = Object.keys(byBda).filter(Boolean).map(Number);
    const { data: bdaUsers } = await supabase.from('users').select('id, name').in('id', bdaIds);
    const nameMap = Object.fromEntries((bdaUsers || []).map(u => [u.id, u.name]));

    const report = Object.entries(byBda).map(([userId, d]) => ({
      userId: Number(userId),
      bdaName: nameMap[Number(userId)] || `BDA #${userId}`,
      missedCount: d.missed,
      leads: d.leads,
    }));

    return res.json({ report });
  } catch (error) {
    console.error('Missed report error:', error);
    return res.status(500).json({ message: 'Error generating missed report: ' + error.message });
  }
});

// POST /api/calling/clear-data - Clear all lead/prospect/followup data (admin only)
router.post('/clear-data', authenticateToken, requireRoles(['admin']), async (req, res) => {
  try {
    const result = {};
    const { error: e1 } = await supabase.from('lead_assignments').delete().neq('id', 0);
    result.leadAssignments = e1 ? 'failed' : 'cleared';

    const { error: e2 } = await supabase.from('calling_sheet').delete().neq('id', 0);
    result.callingSheet = e2 ? 'failed' : 'cleared';

    const { error: e3 } = await supabase.from('followups').delete().neq('id', 0);
    result.followups = e3 ? 'failed' : 'cleared';

    const { error: e4 } = await supabase.from('prospects').delete().neq('id', 0);
    result.prospects = e4 ? 'failed' : 'cleared';

    const { error: e5 } = await supabase.from('leads').delete().neq('id', 0);
    result.leads = e5 ? 'failed' : 'cleared';

    const hasError = [e1, e2, e3, e4, e5].some(e => e);
    return res.status(hasError ? 500 : 200).json({
      message: hasError ? 'Some tables failed to clear.' : 'All data cleared successfully.',
      result,
    });
  } catch (error) {
    console.error('Clear data error:', error);
    return res.status(500).json({ message: 'Error clearing data: ' + error.message });
  }
});

// POST /api/calling/track-sales-call - Track a call from Prospects page as Sales
router.post('/track-sales-call', authenticateToken, requireRoles(['bda']), async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('kpi_records')
      .select('id, eSS')
      .eq('userId', req.user.id)
      .eq('date', todayStr)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('kpi_records')
        .update({ eSS: (existing.eSS || 0) + 1 })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('kpi_records')
        .insert({ userId: req.user.id, date: todayStr, eSS: 1 });
      if (error) throw error;
    }
    return res.json({ message: 'Sales call tracked.' });
  } catch (error) {
    console.error('Track sales call error:', error);
    return res.status(500).json({ message: 'Error tracking sales call.' });
  }
});

// POST /api/calling/eod-run - End-of-Day process (manual trigger)
router.post('/eod-run', authenticateToken, requireRoles(['admin', 'ops_head', 'hr']), async (req, res) => {
  try {
    const { runEndOfDay } = require('../services/endOfDay');
    const results = await runEndOfDay();
    return res.json({ message: 'EOD process completed.', results });
  } catch (error) {
    console.error('EOD run error:', error);
    return res.status(500).json({ message: 'EOD process failed: ' + error.message });
  }
});

module.exports = router;

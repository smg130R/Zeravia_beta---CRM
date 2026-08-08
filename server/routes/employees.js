const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/employees - All employees (Admin, HR, Ops Head, Team Lead)
router.get('/', authenticateToken, requireRoles(['admin', 'hr', 'ops_head', 'team_lead']), async (req, res) => {
  try {
    const fields = 'id, name, email, role, phone, teamId, joinedDate, status, employeeCode';
    let query = supabase.from('users').select(fields);

    // Team leads only see their own team
    if (req.user.role === 'team_lead') {
      query = query.eq('teamId', req.user.teamId);
    }

    query = query.order('role').order('name');
    const { data, error } = await query;

    if (error) {
      // employeeCode column may not exist yet — fall back
      const fallbackFields = 'id, name, email, role, phone, teamId, joinedDate, status';
      let fb = supabase.from('users').select(fallbackFields);
      if (req.user.role === 'team_lead') fb = fb.eq('teamId', req.user.teamId);
      const { data: fallback, error: fallbackErr } = await fb.order('role').order('name');
      if (fallbackErr) throw fallbackErr;
      return res.json({ employees: fallback });
    }
    return res.json({ employees: data });
  } catch (error) {
    console.error('Get employees error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/employees/next-code - No longer auto-generates (manual entry)
router.get('/next-code', authenticateToken, async (req, res) => {
  return res.json({ nextCode: '' });
});

// GET /api/employees/teams - List all teams and their leads
router.get('/teams', authenticateToken, requireRoles(['admin', 'ops_head', 'hr', 'team_lead']), async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, leadId, users(name, email)')
      .order('id');

    if (error) throw error;

    // Reshape to match old API: leadName, leadEmail at top level
    const shaped = (teams || []).map(t => ({
      id: t.id,
      name: t.name,
      leadId: t.leadId,
      leadName: t.users?.name || null,
      leadEmail: t.users?.email || null
    }));

    return res.json({ teams: shaped });
  } catch (error) {
    console.error('Get teams error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/employees/teams/summary - Teams with today's KPI aggregates
router.get('/teams/summary', authenticateToken, requireRoles(['admin', 'ops_head', 'hr', 'team_lead']), async (req, res) => {
  const dateFilter = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const { data: teams, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, leadId, users(name, email)')
      .order('id');

    if (teamErr) throw teamErr;

    const result = [];
    for (const team of teams || []) {
      const { data: bdas } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'bda')
        .eq('teamId', team.id);

      const ids = (bdas || []).map(b => b.id);
      if (ids.length === 0) {
        result.push({
          id: team.id, name: team.name, leadName: team.users?.name || null, leadEmail: team.users?.email || null,
          calls: 0, connects: 0, screenshots: 0, prospects: 0, sCalls: 0, deals: 0, followups: 0, score: 0, memberCount: 0
        });
        continue;
      }

      const { data: rows } = await supabase
        .from('kpi_records')
        .select('mCalls, eCalls, mConn, eConn, mSS, mPros, ePros, eSS, deals, followups, perfScore')
        .eq('date', dateFilter)
        .in('userId', ids);

      let calls = 0, connects = 0, screenshots = 0, prospects = 0, sCalls = 0, deals = 0, followups = 0, score = 0;
      (rows || []).forEach(r => {
        calls += (r.mCalls || 0) + (r.eCalls || 0);
        connects += (r.mConn || 0) + (r.eConn || 0);
        screenshots += (r.mSS || 0);
        prospects += (r.mPros || 0) + (r.ePros || 0);
        sCalls += (r.eSS || 0);
        deals += r.deals || 0;
        followups += r.followups || 0;
        score += r.perfScore || 0;
      });

      result.push({
        id: team.id, name: team.name, leadName: team.users?.name || null, leadEmail: team.users?.email || null,
        calls, connects, screenshots, prospects, sCalls, deals, followups,
        score: rows?.length ? parseFloat((score / rows.length).toFixed(2)) : 0,
        memberCount: ids.length,
      });
    }

    return res.json({ teams: result });
  } catch (error) {
    console.error('Teams summary error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/employees/teams/:teamId/bda-performance
router.get('/teams/:teamId/bda-performance', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const dateFilter = req.query.date || new Date().toISOString().split('T')[0];

  if (req.user.role === 'team_lead' && req.user.teamId !== teamId) {
    return res.status(403).json({ message: 'Access denied. You can only view your own team.' });
  }
  if (!['admin', 'ops_head', 'team_lead'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Unauthorized role.' });
  }

  try {
    // Get BDAs in team
    const { data: bdas, error: bdaErr } = await supabase
      .from('users')
      .select('id, name, email, phone, status')
      .eq('role', 'bda')
      .eq('teamId', teamId);

    if (bdaErr) throw bdaErr;

    // Get KPI records for those BDAs on the date
    const bdaIds = (bdas || []).map(b => b.id);
    const { data: kpis, error: kpiErr } = await supabase
      .from('kpi_records')
      .select('*')
      .in('userId', bdaIds.length ? bdaIds : [0])
      .eq('date', dateFilter);

    if (kpiErr) throw kpiErr;

    const kpiMap = {};
    (kpis || []).forEach(k => { kpiMap[k.userId] = k; });

    const performance = (bdas || []).map(u => {
      const k = kpiMap[u.id] || {};
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        userStatus: u.status,
        date: k.date || null,
        mCalls: k.mCalls || 0,
        mConn: k.mConn || 0,
        mSS: k.mSS || 0,
        mPros: k.mPros || 0,
        eCalls: k.eCalls || 0,
        eConn: k.eConn || 0,
        eSS: k.eSS || 0,
        ePros: k.ePros || 0,
        deals: k.deals || 0,
        followups: k.followups || 0,
        perfScore: k.perfScore || 0
      };
    }).sort((a, b) => b.perfScore - a.perfScore || a.name.localeCompare(b.name));

    // Get team lead
    const { data: leads } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('role', 'team_lead')
      .eq('teamId', teamId);

    return res.json({ teamId, teamLead: leads?.[0] || null, date: dateFilter, performance });
  } catch (error) {
    console.error('Get team performance error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/employees - Add new employee
router.post('/', authenticateToken, requireRoles(['admin', 'hr', 'ops_head', 'team_lead']), async (req, res) => {
  const { name, email, role, phone, teamId, teamName, password, employeeCode } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({ message: 'Name, email, role, and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const validRoles = ['admin', 'ops_head', 'hr', 'team_lead', 'bda'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  // Role-based permission: who can create whom
  const createPermissions = {
    admin: ['admin', 'ops_head', 'hr', 'team_lead', 'bda'],
    hr: ['team_lead', 'bda'],
    ops_head: ['team_lead', 'bda'],
    team_lead: ['bda']
  };
  const allowedTargets = createPermissions[req.user.role] || [];
  if (!allowedTargets.includes(role)) {
    return res.status(403).json({ message: `You do not have permission to create ${role} accounts.` });
  }

  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone, teamId }
    });

    if (authError) {
      if (authError.message?.includes('already exists') || authError.message?.includes('already been registered') || authError.code === 'email_exists' || authError.code === 'duplicate') {
        return res.status(400).json({ message: 'Email address already exists.' });
      }
      console.error('Create employee auth error:', authError.message, authError.status);
      return res.status(500).json({ message: 'Failed to create employee account.' });
    }

    // The handle_new_user trigger already inserted the row; fetch it
    const { data: existing, error: fetchErr } = await supabase
      .from('users')
      .select('id')
      .eq('authId', authData.user.id);

    let userRow;
    if (!fetchErr && existing && existing.length > 0) {
      userRow = existing[0];
    } else {
      // Trigger may not exist — insert manually
      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({
          name,
          email,
          role,
          phone: phone || null,
          teamId: teamId || null,
          status: 'active',
          authId: authData.user.id
        })
        .select('id')
        .limit(1);

      if (insertErr) {
        console.error('Insert user row error:', insertErr.message);
        return res.status(500).json({ message: 'Failed to create user record.' });
      }
      userRow = newUser[0];
    }

    const newUserId = userRow.id;

    // Set employeeCode if provided (manual entry)
    if (employeeCode) {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ employeeCode })
        .eq('id', newUserId);
      if (updateErr) console.error('Assign employeeCode error:', updateErr.message);
    }

    // If creating a team lead with a team name, create the team record
    if (role === 'team_lead' && req.body.teamName && newUserId) {
      const teamId = req.body.teamName.replace(/\s+/g, '');
      const { error: teamErr } = await supabase.from('teams').insert({
        id: teamId,
        name: req.body.teamName,
        leadId: newUserId
      });

      if (teamErr) {
        console.error('Create team error:', teamErr.message);
      } else {
        await supabase.from('users').update({ teamId }).eq('id', newUserId);
      }
    }

    return res.status(201).json({ message: 'Employee added successfully.' });
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/employees/:id - Remove employee (deactivate + reassign)
router.delete('/:id', authenticateToken, requireRoles(['admin', 'hr', 'ops_head', 'team_lead']), async (req, res) => {
  const { id } = req.params;
  try {
    const { data: target, error: findErr } = await supabase
      .from('users').select('id, name, role, teamId, authId').eq('id', id).single();
    if (findErr || !target) return res.status(404).json({ message: 'Employee not found.' });

    // Team leads can only remove BDAs from their own team
    if (req.user.role === 'team_lead') {
      if (target.role !== 'bda' || target.teamId !== req.user.teamId) {
        return res.status(403).json({ message: 'You can only remove BDAs from your own team.' });
      }
    }

    // 1. Unassign leads
    await supabase.from('leads').update({ currentAssigneeId: null, status: 'unassigned' }).eq('currentAssigneeId', id);

    // 2. Unassign prospects
    await supabase.from('prospects').update({ bdaId: null }).eq('bdaId', id);

    // 3. Delete calling sheet entries
    await supabase.from('calling_sheet').delete().eq('assignedUserId', id);

    // 4. Deactivate user
    const { error: deactErr } = await supabase.from('users').update({ status: 'suspended' }).eq('id', id);
    if (deactErr) throw deactErr;

    // 5. Delete from Supabase Auth (if authId exists)
    if (target.authId) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(target.authId);
      if (authErr) console.error('Delete auth user error:', authErr.message);
    }

    return res.json({ message: `${target.name} removed successfully. Leads and prospects have been unassigned.` });
  } catch (error) {
    console.error('Remove employee error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

// ==========================================================================
// BACKEND API INTEGRATION
// ==========================================================================

const API_BASE = 'http://localhost:5000/api';

// Global state for logged-in user
let currentUser = null;
let currentRole = null;

// In-memory cache for data fetched from backend
let employeesData = [];
let kpiBoardData = [];
let salesCallingData = [];
let followUpsData = [];
let leaveRequestsData = [];
let complaintsData = [];
let activePage = "dashboard";
let charts = {};

// Utility: Fetch with error handling
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    showToast(error.message, true);
    throw error;
  }
}

// Utility: Format user data for display
function formatUserForDisplay(user) {
  const roleColors = {
    admin: 'var(--danger)',
    ops_head: 'var(--accent-blue)',
    hr: 'var(--purple)',
    team_lead: 'var(--warning)',
    bda: 'var(--success)'
  };

  return {
    name: user.name,
    role: user.role.toUpperCase(),
    title: `${user.role.replace('_', ' ').toUpperCase()} — ${user.name}`,
    avatar: user.name.split(' ').map(n => n[0]).join('').substring(0, 2),
    team: user.teamId || 'All',
    color: roleColors[user.role] || 'var(--text-muted)'
  };
}

// ==========================================================================
// LOGIN FUNCTION - NOW CALLS BACKEND
// ==========================================================================

async function loginUser(email, password) {
  try {
    showToast('Authenticating...');
    
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    currentUser = data.user;
    currentRole = data.user.role;

    // Hide Login Page, Show Layout
    document.getElementById("login-view").style.display = "none";
    document.getElementById("app-layout").classList.remove("hidden");

    // Update UI with user info
    const profile = formatUserForDisplay(currentUser);

    // Update Header
    document.getElementById("header-profile-name").innerText = profile.name;
    document.getElementById("header-profile-role").innerText = profile.title;
    const headerAvatar = document.getElementById("header-profile-avatar");
    headerAvatar.innerText = profile.avatar;
    headerAvatar.style.backgroundColor = profile.color;

    // Update Sidebar
    document.getElementById("sidebar-user-name").innerText = profile.name;
    document.getElementById("sidebar-role-title").innerText = profile.role;
    const sidebarAvatar = document.getElementById("sidebar-user-avatar");
    sidebarAvatar.innerText = profile.avatar;
    sidebarAvatar.style.backgroundColor = profile.color;
    document.getElementById("selected-role-preview").innerText = profile.role;

    // Apply role-based permissions
    applyRolePermissions(currentRole);

    // Load data from backend
    await loadDashboardData();

    // Route to dashboard
    switchPage("dashboard");
    showToast(`Logged in as ${profile.name}`);

  } catch (error) {
    showToast('Login failed: ' + error.message, true);
  }
}

// ==========================================================================
// LOAD DATA FROM BACKEND
// ==========================================================================

async function loadDashboardData() {
  try {
    // Load employees
    const empRes = await apiCall('/employees');
    employeesData = empRes.employees || [];

    // Load KPI records - IMPORTANT: Store in kpiBoardData
    const kpiRes = await apiCall('/kpi/dashboard?date=' + new Date().toISOString().split('T')[0]);
    // Transform API response to match UI expectations
    kpiBoardData = (kpiRes.kpiData || []).map(record => ({
      name: record.userName,
      lead: record.teamLead,
      mCalls: record.mCalls || 0,
      mConn: record.mConn || 0,
      mSS: record.mSS || 0,
      mPros: record.mPros || 0,
      eCalls: record.eCalls || 0,
      eConn: record.eConn || 0,
      eSS: record.eSS || 0,
      ePros: record.ePros || 0,
      deals: record.deals || 0,
      followups: record.followups || 0,
      performance: record.perfScore || 0,
      status: record.perfScore >= 75 ? 'Excellent' : record.perfScore >= 60 ? 'Good' : 'Needs Push'
    }));
    
    // Load calling sheet (if BDA)
    if (currentRole === 'bda') {
      const callingRes = await apiCall('/calling');
      salesCallingData = callingRes.callingSheet || [];
    }

    // Load followups
    const followupRes = await apiCall('/followups');
    followUpsData = followupRes.followups || [];

    // Load leaves
    const leaveRes = await apiCall('/leaves');
    leaveRequestsData = leaveRes.leaves || [];

    // Load complaints (if admin or hr)
    if (['admin', 'hr'].includes(currentRole)) {
      const complaintRes = await apiCall('/complaints');
      complaintsData = complaintRes.complaints || [];
    }

    console.log('Dashboard data loaded:', { employeesData, kpiBoardData, salesCallingData });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load data from server', true);
  }
}

function logoutUser() {
  currentUser = null;
  currentRole = null;
  document.getElementById("app-layout").classList.add("hidden");
  document.getElementById("login-view").style.display = "flex";
  showToast("Logged out successfully");
}

// ==========================================================================
// ROLE ACCESS CONTROL
// ==========================================================================

function applyRolePermissions(role) {
  const menuItems = document.querySelectorAll(".sidebar-menu-item");
  const bannerTitle = document.getElementById("role-banner-title");
  const bannerDesc = document.getElementById("role-banner-desc");

  const permissions = {
    admin: ["dashboard", "kpi-board", "team-structure", "employee-master", "sales-calling", "follow-ups", "reports", "hr-desk", "settings"],
    ops_head: ["dashboard", "kpi-board", "team-structure", "follow-ups", "reports", "settings"],
    hr: ["dashboard", "employee-master", "hr-desk", "settings"],
    team_lead: ["dashboard", "kpi-board", "team-structure", "follow-ups", "reports"],
    bda: ["dashboard", "sales-calling", "follow-ups"]
  };

  const allowedPages = permissions[role] || ["dashboard"];

  menuItems.forEach(item => {
    const page = item.getAttribute("data-page");
    if (allowedPages.includes(page)) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });

  // Customize banners
  if (role === "admin") {
    bannerTitle.innerText = "Welcome back, Admin Panel";
    bannerDesc.innerText = "You have full administrative privileges. Monitor KPI dashboards, manage roles, and configure integrations.";
  } else if (role === "ops_head") {
    bannerTitle.innerText = "Operations Dashboard";
    bannerDesc.innerText = "Tracking company-wide sales metrics, team comparisons, and performance alerts.";
  } else if (role === "hr") {
    bannerTitle.innerText = "Human Resources Hub";
    bannerDesc.innerText = "Manage employee directory, leave requests, and team announcements.";
  } else if (role === "team_lead") {
    bannerTitle.innerText = `Team Management Portal`;
    bannerDesc.innerText = "Review team KPI scores and schedule customer follow-ups.";
  } else if (role === "bda") {
    bannerTitle.innerText = `Sales Portal`;
    bannerDesc.innerText = "Update customer calling logs and manage follow-ups.";
  }

  // Show/Hide complaint button
  const bdaComplaintBtn = document.getElementById("bda-file-complaint-btn");
  if (bdaComplaintBtn) {
    bdaComplaintBtn.style.display = role === "bda" ? "inline-flex" : "none";
  }

  // Show/Hide complaints card
  const adminComplaintsCard = document.getElementById("admin-complaints-card");
  const hrComplaintsCard = document.getElementById("hr-complaints-card");
  if (adminComplaintsCard) {
    adminComplaintsCard.style.display = role === "admin" ? "block" : "none";
  }
  if (hrComplaintsCard) {
    hrComplaintsCard.style.display = role === "hr" ? "block" : "none";
  }
}

// ==========================================================================
// INITIALIZATION & LOGIN LOGIC
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Quick login role preview cards - maps role to test credentials
  const roleCredentials = {
    Admin: { email: 'admin1@officeconnect.com', password: 'password123' },
    'Operations Head': { email: 'ops@officeconnect.com', password: 'password123' },
    HR: { email: 'hr@officeconnect.com', password: 'password123' },
    'Team Lead': { email: 'rohan@officeconnect.com', password: 'password123' },
    BDA: { email: 'bda1@officeconnect.com', password: 'password123' }
  };

  // Bind Login Role Preview Cards
  document.querySelectorAll(".role-preview-card").forEach(card => {
    card.addEventListener("click", () => {
      const role = card.getAttribute("data-role");
      const creds = roleCredentials[role];
      if (creds) {
        loginUser(creds.email, creds.password);
      }
    });
  });
  
  // Standard Login Button Click
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = document.getElementById("login-email")?.value;
      const password = document.getElementById("login-password")?.value;
      if (email && password) {
        loginUser(email, password);
      } else {
        showToast("Please enter email and password", true);
      }
    });
  }
  
  // Logout Trigger
  const logoutBtn = document.getElementById("logout-header-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }
  
  // Sidebar items navigation
  document.querySelectorAll(".sidebar-menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.getAttribute("data-page");
      switchPage(page);
    });
  });
  
  // Date Range Filters Trigger
  const dateFilterContainer = document.getElementById("header-date-filter");
  if (dateFilterContainer) {
    dateFilterContainer.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        dateFilterContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const days = btn.innerText;
        updateKpiStats(days);
        showToast(`Data filtered for: ${days}`);
      });
    });
  }
  
  // Role switcher dropdown inside sidebar
  const dropdownTrigger = document.getElementById("role-select-trigger");
  const dropdownMenu = document.getElementById("role-dropdown-menu");
  
  if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });
    
    document.addEventListener("click", () => {
      dropdownMenu.classList.remove("show");
    });
    
    dropdownMenu.querySelectorAll(".role-dropdown-item").forEach(item => {
      item.addEventListener("click", () => {
        const targetRole = item.getAttribute("data-role");
        dropdownMenu.querySelectorAll(".role-dropdown-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        
        // Quick switch for demo purposes
        const roleCreds = {
          Admin: { email: 'admin1@officeconnect.com', password: 'password123' },
          'Operations Head': { email: 'ops@officeconnect.com', password: 'password123' },
          HR: { email: 'hr@officeconnect.com', password: 'password123' },
          'Team Lead': { email: 'rohan@officeconnect.com', password: 'password123' },
          BDA: { email: 'bda1@officeconnect.com', password: 'password123' }
        };
        
        const creds = roleCreds[targetRole];
        if (creds) {
          loginUser(creds.email, creds.password).catch(() => {
            showToast(`Failed to switch to ${targetRole}`, true);
          });
        }
      });
    });
  }

  // Mobile Menu Drawer Toggles
  const menuOpenBtn = document.getElementById("menu-open-btn");
  const menuCloseBtn = document.getElementById("menu-close-btn");
  const sidebar = document.getElementById("sidebar");

  if (menuOpenBtn) menuOpenBtn.addEventListener("click", () => sidebar?.classList.add("open"));
  if (menuCloseBtn) menuCloseBtn.addEventListener("click", () => sidebar?.classList.remove("open"));

  // KPI Table Filters
  const teamLeadFilter = document.getElementById("kpi-team-lead-filter");
  if (teamLeadFilter) {
    teamLeadFilter.addEventListener("change", (e) => {
      renderKpiBoard(e.target.value);
    });
  }

  // Sync Button
  const kpiSyncBtn = document.getElementById("kpi-sync-btn");
  if (kpiSyncBtn) {
    kpiSyncBtn.addEventListener("click", () => {
      showToast("Syncing records with Supabase...");
      setTimeout(() => {
        // Reload data from backend
        loadDashboardData().then(() => {
          renderKpiBoard(teamLeadFilter?.value || "All");
          initializeCharts();
          showToast("Synchronized with Supabase successfully!");
        });
      }, 1000);
    });
  }

  // Employee Add Modal bindings
  const openModalBtn = document.getElementById("open-add-emp-modal-btn");
  const closeModalBtn = document.getElementById("modal-close-icon");
  const cancelModalBtn = document.getElementById("modal-cancel-btn");
  const saveModalBtn = document.getElementById("modal-save-btn");
  const modalOverlay = document.getElementById("add-employee-modal");

  if (openModalBtn && modalOverlay) {
    openModalBtn.addEventListener("click", () => modalOverlay.classList.add("show"));
  }
  
  const closeModal = () => modalOverlay?.classList.remove("show");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);

  if (saveModalBtn) {
    saveModalBtn.addEventListener("click", () => {
      const name = document.getElementById("emp-name")?.value;
      const role = document.getElementById("emp-role")?.value;
      const email = document.getElementById("emp-email")?.value;
      const phone = document.getElementById("emp-phone")?.value;

      if (!name || !email) {
        showToast("Please fill in Name and Email fields!", true);
        return;
      }

      // Call backend to create employee
      apiCall('/employees', {
        method: 'POST',
        body: JSON.stringify({ name, role, email, phone })
      }).then(() => {
        showToast(`Created employee profile for ${name}!`);
        closeModal();
        loadDashboardData().then(() => renderEmployeeMaster());
      }).catch(err => {
        showToast('Failed to create employee: ' + err.message, true);
      });
    });
  }

  // Complaint Modal bindings
  const openComplaintModalBtn = document.getElementById("bda-file-complaint-btn");
  const closeComplaintModalBtn = document.getElementById("complaint-modal-close-icon");
  const cancelComplaintModalBtn = document.getElementById("complaint-modal-cancel-btn");
  const saveComplaintModalBtn = document.getElementById("complaint-modal-save-btn");
  const complaintModalOverlay = document.getElementById("complaint-modal");

  if (openComplaintModalBtn && complaintModalOverlay) {
    openComplaintModalBtn.addEventListener("click", () => {
      document.getElementById("complaint-subject").value = "";
      document.getElementById("complaint-details").value = "";
      complaintModalOverlay.classList.add("show");
    });
  }
  
  const closeComplaintModal = () => complaintModalOverlay?.classList.remove("show");
  if (closeComplaintModalBtn) closeComplaintModalBtn.addEventListener("click", closeComplaintModal);
  if (cancelComplaintModalBtn) cancelComplaintModalBtn.addEventListener("click", closeComplaintModal);

  if (saveComplaintModalBtn) {
    saveComplaintModalBtn.addEventListener("click", () => {
      const recipientRole = document.getElementById("complaint-recipient")?.value;
      const subject = document.getElementById("complaint-subject")?.value;
      const details = document.getElementById("complaint-details")?.value;

      if (!subject || !details) {
        showToast("Please fill in Subject and Details fields!", true);
        return;
      }

      // Call backend to submit complaint
      apiCall('/complaints', {
        method: 'POST',
        body: JSON.stringify({ recipientRole, subject, details })
      }).then(() => {
        showToast(`Complaint submitted successfully to ${recipientRole}!`);
        closeComplaintModal();
        loadDashboardData().then(() => renderComplaintsTable());
      }).catch(err => {
        showToast('Failed to submit complaint: ' + err.message, true);
      });
    });
  }

  // Lucide Icons initialization
  lucide.createIcons();
});

// ==========================================================================
// ROLE ACCESS CONTROL (SIDEBAR MAPPING)
// ==========================================================================

function applyRolePermissions(role) {
  const menuItems = document.querySelectorAll(".sidebar-menu-item");
  const bannerTitle = document.getElementById("role-banner-title");
  const bannerDesc = document.getElementById("role-banner-desc");

  // Define sidebar accessibility by role
  const permissions = {
    'admin': ["dashboard", "kpi-board", "team-structure", "employee-master", "sales-calling", "follow-ups", "reports", "hr-desk", "settings"],
    "ops_head": ["dashboard", "kpi-board", "team-structure", "follow-ups", "reports", "settings"],
    'hr': ["dashboard", "employee-master", "hr-desk", "settings"],
    "team_lead": ["dashboard", "kpi-board", "team-structure", "follow-ups", "reports"],
    BDA: ["dashboard", "sales-calling", "follow-ups"]
  };

  const allowedPages = permissions[role] || ["dashboard"];

  menuItems.forEach(item => {
    const page = item.getAttribute("data-page");
    if (allowedPages.includes(page)) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });

  // Customize welcome banners based on role
  if (role === "Admin") {
    bannerTitle.innerText = "Welcome back, Admin Panel";
    bannerDesc.innerText = "You have full administrative privileges. Monitor business intelligence KPI dashboards, manage company roles, and configure sheet integrations below.";
  } else if (role === "Operations Head") {
    bannerTitle.innerText = "Operations Dashboard Focus";
    bannerDesc.innerText = "Tracking company-wide sales conversions, BDA ranking logs, team productivity comparisons, and low performance deficit alerts.";
  } else if (role === "HR") {
    bannerTitle.innerText = "Human Resources Hub";
    bannerDesc.innerText = "Accessing Employee Directories, leave request tables, work anniversaries, and publishing team-wide announcements.";
  } else if (role === "Team Lead") {
    bannerTitle.innerText = `Team Alpha Overview — Rohan Khanna`;
    bannerDesc.innerText = "Reviewing daily morning/evening slot calls for 12 BDAs. Address low performance tags and schedule immediate customer follow-ups.";
  } else if (role === "BDA") {
    bannerTitle.innerText = `BDA Sales Portal — Sana Ali`;
    bannerDesc.innerText = "Manage your assigned customer calling logs. Update customer status tags directly to synchronize data with management.";
  }

  // Show/Hide File Complaint button (BDA only)
  const bdaComplaintBtn = document.getElementById("bda-file-complaint-btn");
  if (bdaComplaintBtn) {
    bdaComplaintBtn.style.display = role === "BDA" ? "inline-flex" : "none";
  }

  // Show/Hide Complaints Register card (Admin = All, HR = HR & Team Lead)
  const adminComplaintsCard = document.getElementById("admin-complaints-card");
  const hrComplaintsCard = document.getElementById("hr-complaints-card");

  if (adminComplaintsCard) {
    adminComplaintsCard.style.display = role === "Admin" ? "block" : "none";
  }
  if (hrComplaintsCard) {
    hrComplaintsCard.style.display = role === "HR" ? "block" : "none";
  }

  // Populate dynamic tables based on newly configured access scopes
  renderKpiBoard();
  renderTeamCards();
  renderEmployeeMaster();
  renderSalesCallingSheet();
  renderFollowUps();
  renderHRDesk();
  renderComplaintsTable();
}

// ==========================================================================
// PAGE ROUTING SWITCHER
// ==========================================================================

function switchPage(pageId) {
  activePage = pageId;
  
  // Highlight active sidebar navigation item
  document.querySelectorAll(".sidebar-menu-item").forEach(item => {
    if (item.getAttribute("data-page") === pageId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
  
  // Toggle Visibility of Views
  document.querySelectorAll(".view-section").forEach(section => {
    if (section.getAttribute("id") === `${pageId}-view`) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });
  
  // Update header text based on page
  const titleMap = {
    dashboard: { title: "Company Dashboard", subtitle: "Overall performance indicators & company metrics" },
    "kpi-board": { title: "KPI Board", subtitle: "Real-time BDA morning & evening sales logs" },
    "team-structure": { title: "Team Structure", subtitle: "Company hierarchy tree & sales division cards" },
    "employee-master": { title: "Employee Master", subtitle: "Active company employee profiles & directory" },
    "sales-calling": { title: "Sales Customer Calling Log", subtitle: "Simulated assigned customer calling sheets" },
    "follow-ups": { title: "Customer Follow-ups", subtitle: "Schedules of pending callbacks & lead statuses" },
    reports: { title: "Visual Analytics Reports", subtitle: "Data visualizations, conversion ratios & export catalogs" },
    "hr-desk": { title: "HR Desk Support", subtitle: "Announcements, leaves, documentation & milestones" },
    settings: { title: "Platform Settings", subtitle: "Google Sheets linking, sync scheduling & KPI targets" }
  };
  
  const textInfo = titleMap[pageId] || { title: "Zeravia_beta---CRM", subtitle: "Office Management Board" };
  document.getElementById("header-page-title").innerText = textInfo.title;
  document.getElementById("header-page-subtitle").innerText = textInfo.subtitle;

  // Render page-specific content
  if (pageId === "dashboard") {
    updateKpiStats();
    renderDashboardLowPerformanceAlerts();
  } else if (pageId === "kpi-board") {
    renderKpiBoard();
  } else if (pageId === "employee-master") {
    renderEmployeeMaster();
  } else if (pageId === "sales-calling") {
    renderSalesCallingSheet();
  } else if (pageId === "follow-ups") {
    renderFollowUps();
  } else if (pageId === "hr-desk") {
    renderHRDesk();
  } else if (pageId === "team-structure") {
    renderTeamCards();
  }

  // Render Charts when entering Dashboard or Reports
  if (pageId === "dashboard" || pageId === "reports") {
    setTimeout(initializeCharts, 100);
  }

  // Close Mobile Drawer
  document.getElementById("sidebar").classList.remove("open");
}

// ==========================================================================
// DYNAMIC COMPONENT RENDERERS
// ==========================================================================

// 1. Dashboard KPI Cards Populator
function updateKpiStats(days = "7 Days") {
  const container = document.getElementById("dashboard-kpi-cards");
  if (!container) return;
  
  // Fallback stats if data doesn't exist
  const fallbackStats = {
    "7 Days": { 
      totalCalls: 420, 
      callsTrend: "+12% from yesterday",
      connectedCalls: 215,
      connectTrend: "51.2% connection rate",
      prospects: 18,
      followUpsTrend: "8 pending follow-up",
      followUps: 45,
      deals: 5,
      dealsTrend: "+₹62,500",
      revenue: "₹62,500",
      revenueTrend: "Highest in Q3"
    },
    "30 Days": { 
      totalCalls: 1800, 
      callsTrend: "+24% from last month",
      connectedCalls: 920,
      connectTrend: "51.1% connection rate",
      prospects: 75,
      followUpsTrend: "32 pending follow-up",
      followUps: 180,
      deals: 22,
      dealsTrend: "+₹275,000",
      revenue: "₹2,75,000",
      revenueTrend: "Highest this quarter"
    }
  };
  
  const stats = fallbackStats[days] || fallbackStats["7 Days"];

  // Custom BDA specific overrides
  if (currentRole === "BDA") {
    container.innerHTML = `
      <div class="kpi-card blue">
        <div class="kpi-card-header">
          <span class="kpi-card-title">My Total Calls</span>
          <div class="kpi-card-icon"><i data-lucide="phone"></i></div>
        </div>
        <div class="kpi-card-value">63</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend up"><i data-lucide="trending-up"></i> +12%</span> from yesterday
        </div>
      </div>

      <div class="kpi-card green">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Connected Calls</span>
          <div class="kpi-card-icon"><i data-lucide="phone-incoming"></i></div>
        </div>
        <div class="kpi-card-value">32</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend">50.8% connection rate</span>
        </div>
      </div>

      <div class="kpi-card orange">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Prospects Created</span>
          <div class="kpi-card-icon"><i data-lucide="user-plus"></i></div>
        </div>
        <div class="kpi-card-value">7</div>
        <div class="kpi-card-footer">
          2 pending follow-up today
        </div>
      </div>

      <div class="kpi-card purple">
        <div class="kpi-card-header">
          <span class="kpi-card-title">My Deals Closed</span>
          <div class="kpi-card-icon"><i data-lucide="shopping-bag"></i></div>
        </div>
        <div class="kpi-card-value">3</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend up">₹37,500 Revenue Generated</span>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Rohan Khanna Team Lead override
  if (currentRole === "Team Lead") {
    container.innerHTML = `
      <div class="kpi-card blue">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Team Alpha Calls</span>
          <div class="kpi-card-icon"><i data-lucide="phone"></i></div>
        </div>
        <div class="kpi-card-value">160</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend up"><i data-lucide="trending-up"></i> +15%</span> vs other teams
        </div>
      </div>

      <div class="kpi-card green">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Team Connects</span>
          <div class="kpi-card-icon"><i data-lucide="phone-incoming"></i></div>
        </div>
        <div class="kpi-card-value">69</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend">43.1% connection rate</span>
        </div>
      </div>

      <div class="kpi-card orange">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Prospects Created</span>
          <div class="kpi-card-icon"><i data-lucide="user-plus"></i></div>
        </div>
        <div class="kpi-card-value">12</div>
        <div class="kpi-card-footer">
          8 follow-ups due today
        </div>
      </div>

      <div class="kpi-card purple">
        <div class="kpi-card-header">
          <span class="kpi-card-title">Team Closed Deals</span>
          <div class="kpi-card-icon"><i data-lucide="shopping-bag"></i></div>
        </div>
        <div class="kpi-card-value">4</div>
        <div class="kpi-card-footer">
          <span class="kpi-trend up">₹50,000 Revenue Logged</span>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Company default for Admin/Operations
  container.innerHTML = `
    <div class="kpi-card blue">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Total Marketing Calls</span>
        <div class="kpi-card-icon"><i data-lucide="phone"></i></div>
      </div>
      <div class="kpi-card-value">${stats.totalCalls}</div>
      <div class="kpi-card-footer">
        <span class="kpi-trend up"><i data-lucide="trending-up"></i> ${stats.callsTrend}</span>
      </div>
    </div>

    <div class="kpi-card green">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Connected Calls</span>
        <div class="kpi-card-icon"><i data-lucide="phone-incoming"></i></div>
      </div>
      <div class="kpi-card-value">${stats.connectedCalls}</div>
      <div class="kpi-card-footer">
        <span class="kpi-trend">${stats.connectTrend}</span>
      </div>
    </div>

    <div class="kpi-card orange">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Prospects Generated</span>
        <div class="kpi-card-icon"><i data-lucide="user-plus"></i></div>
      </div>
      <div class="kpi-card-value">${stats.prospects}</div>
      <div class="kpi-card-footer">
        <span class="kpi-trend">${stats.followUpsTrend}</span>
      </div>
    </div>

    <div class="kpi-card purple">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Follow-ups Logged</span>
        <div class="kpi-card-icon"><i data-lucide="calendar"></i></div>
      </div>
      <div class="kpi-card-value">${stats.followUps}</div>
      <div class="kpi-card-footer">
        <span>Average ${days === "Today" ? "12" : "32"} followups closed</span>
      </div>
    </div>

    <div class="kpi-card red">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Deals Closed</span>
        <div class="kpi-card-icon"><i data-lucide="shopping-bag"></i></div>
      </div>
      <div class="kpi-card-value">${stats.deals}</div>
      <div class="kpi-card-footer">
        <span class="kpi-trend up">${stats.dealsTrend}</span>
      </div>
    </div>

    <div class="kpi-card cyan">
      <div class="kpi-card-header">
        <span class="kpi-card-title">Revenue Generated</span>
        <div class="kpi-card-icon"><i data-lucide="credit-card"></i></div>
      </div>
      <div class="kpi-card-value">${stats.revenue}</div>
      <div class="kpi-card-footer">
        <span>${stats.revenueTrend}</span>
      </div>
    </div>
  `;
  lucide.createIcons();

  // Populate Dashboard Low Performance List (Admin, Ops and Team Lead focus)
  renderDashboardLowPerformanceAlerts();
}

// 2. Dashboard Low Performance Alert Table Populator
function renderDashboardLowPerformanceAlerts() {
  const tbody = document.getElementById("low-performance-alerts-tbody");
  if (!tbody) return;

  // Filter low performance BDAs (score < 40)
  const lowBDAs = kpiBoardData.filter(bda => bda.performance < 40);

  tbody.innerHTML = "";
  
  if (lowBDAs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No performance warnings. All agents exceed standards!</td></tr>`;
    return;
  }

  lowBDAs.forEach(bda => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--primary-navy);">${bda.name}</td>
      <td>${bda.lead}</td>
      <td>${bda.totalSales} Calls</td>
      <td>
        <div class="table-progress-wrapper">
          <div class="table-progress-bg">
            <div class="table-progress-bar red" style="width: ${bda.performance}%"></div>
          </div>
          <span class="table-progress-text">${bda.performance}%</span>
        </div>
      </td>
      <td><span class="badge needs-push">${bda.status}</span></td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="alert('Simulated: Notification ping sent to lead ${bda.lead} to schedule coaching session for ${bda.name}.')">
          Ping Lead
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. KPI Board Wide Table Populator
function renderKpiBoard(filterLead = "All") {
  const tbody = document.getElementById("kpi-board-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  // Operations Head/TL overrides filter logic automatically
  let targetLead = filterLead;
  if (currentRole === "Team Lead") {
    targetLead = "Rohan Khanna";
    const dropdown = document.getElementById("kpi-team-lead-filter");
    if (dropdown) {
      dropdown.value = "Rohan Khanna";
      dropdown.disabled = true; // TL can't switch to other teams
    }
  } else {
    const dropdown = document.getElementById("kpi-team-lead-filter");
    if (dropdown) dropdown.disabled = false;
  }

  const rows = kpiBoardData.filter(row => {
    if (targetLead !== "All" && row.lead !== targetLead) return false;
    // BDA can only view their own score card
    if (currentRole === "BDA" && row.name !== "Sana Ali") return false;
    return true;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="18" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found. Adjust filters.</td></tr>`;
    return;
  }

  rows.forEach(bda => {
    const tr = document.createElement("tr");
    
    // Pick color for status badge
    let statusClass = "no-update";
    if (bda.status === "Excellent") statusClass = "excellent";
    else if (bda.status === "Good") statusClass = "good";
    else if (bda.status === "Average") statusClass = "average";
    else if (bda.status === "Needs Push") statusClass = "needs-push";
    
    // Pick progress bar color
    let barColor = "green";
    if (bda.performance < 40) barColor = "red";
    else if (bda.performance < 75) barColor = "orange";
    
    tr.innerHTML = `
      <td style="position: sticky; left: 0; z-index: 2; background: white; font-weight: 600; color: var(--primary-navy); border-right: 1px solid var(--border-color);">
        ${bda.name}
      </td>
      <td>${bda.lead}</td>
      
      <!-- Morning Slot (11 AM to 2 PM) -->
      <td style="border-left: 2px solid var(--border-color);">${bda.mCalls}</td>
      <td>${bda.mConn}</td>
      <td>${bda.mSS}</td>
      <td style="border-right: 2px solid var(--border-color); font-weight: 600;">${bda.mPros}</td>
      
      <!-- Evening Slot (3:15 PM to 5 PM) -->
      <td>${bda.eCalls}</td>
      <td>${bda.eConn}</td>
      <td>${bda.eSS}</td>
      <td style="border-right: 2px solid var(--border-color); font-weight: 600;">${bda.ePros}</td>
      
      <!-- Overall Metrics -->
      <td style="background-color: var(--accent-blue-light); font-weight: 700; color: var(--accent-blue);">${bda.totalPros}</td>
      <td>${bda.totalSales}</td>
      <td>${bda.connSales}</td>
      <td>${bda.pLink}</td>
      <td style="background-color: var(--success-light); font-weight: 700; color: var(--success);">${bda.deals}</td>
      <td>${bda.followups}</td>
      <td>
        <div class="table-progress-wrapper">
          <div class="table-progress-bg">
            <div class="table-progress-bar ${barColor}" style="width: ${bda.performance}%"></div>
          </div>
          <span class="table-progress-text">${bda.performance}%</span>
        </div>
      </td>
      <td><span class="badge ${statusClass}">${bda.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 4. Team Cards Renderers
function renderTeamCards() {
  const container = document.getElementById("team-cards-container");
  if (!container) return;
  
  // Cards data
  const teams = [
    { name: "Team Alpha", lead: "Rohan Khanna", size: 12, calls: 278, connects: 119, prospects: 12, deals: 4, score: 82, status: "Good" },
    { name: "Team Beta", lead: "Kavya Nair", size: 14, calls: 320, connects: 151, prospects: 19, deals: 6, score: 91, status: "Excellent" },
    { name: "Team Gamma", lead: "Dev Malhotra", size: 10, calls: 180, connects: 67, prospects: 6, deals: 2, score: 55, status: "Average" },
    { name: "Team Delta", lead: "Ishita Sen", size: 13, calls: 246, connects: 98, prospects: 11, deals: 3, score: 71, status: "Good" }
  ];

  container.innerHTML = "";
  
  teams.forEach(team => {
    // If current role is Team Lead and doesn't manage this team, skip (unless they are Ops / Admin)
    if (currentRole === "Team Lead" && team.lead !== "Rohan Khanna") return;
    
    // Pick color for status badge
    let statusClass = "no-update";
    if (team.status === "Excellent") statusClass = "excellent";
    else if (team.status === "Good") statusClass = "good";
    else if (team.status === "Average") statusClass = "average";
    
    // Progress bar color
    let barColor = "green";
    if (team.score < 60) barColor = "orange";
    
    const card = document.createElement("div");
    card.className = "team-card";
    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-card-info">
          <h3>${team.name}</h3>
          <p>Lead: ${team.lead}</p>
        </div>
        <span class="badge ${statusClass}">${team.status}</span>
      </div>
      
      <div class="team-stats-grid">
        <div class="team-stat-item">
          <div class="label">BDAs</div>
          <div class="value">${team.size}</div>
        </div>
        <div class="team-stat-item">
          <div class="label">Total Calls</div>
          <div class="value">${team.calls}</div>
        </div>
        <div class="team-stat-item">
          <div class="label">Connects</div>
          <div class="value">${team.connects}</div>
        </div>
        <div class="team-stat-item">
          <div class="label">Deals</div>
          <div class="value">${team.deals}</div>
        </div>
      </div>
      
      <div class="team-score-wrapper">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Overall Team Score:</span>
        <div class="table-progress-wrapper" style="width: 140px;">
          <div class="table-progress-bg">
            <div class="table-progress-bar ${barColor}" style="width: ${team.score}%"></div>
          </div>
          <span class="table-progress-text">${team.score}%</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 5. Employee Master Grid Render
function renderEmployeeMaster() {
  const tbody = document.getElementById("employee-master-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  employeesData.forEach(emp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--primary-navy);">${emp.id}</td>
      <td>
        <div class="table-user-cell">
          <div class="table-user-avatar">${emp.name.split(" ").map(n => n[0]).join("")}</div>
          <div class="table-user-meta">
            <span class="table-user-title">${emp.name}</span>
            <span class="table-user-subtitle">${emp.email}</span>
          </div>
        </div>
      </td>
      <td>${emp.role}</td>
      <td>${emp.email}</td>
      <td>${emp.phone}</td>
      <td>${emp.lead}</td>
      <td>${emp.team}</td>
      <td>${emp.joined}</td>
      <td><span class="badge excellent">${emp.status}</span></td>
      <td><span class="badge good">${emp.access}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 6. BDA Customer Calling Sheet Simulator
function renderSalesCallingSheet() {
  const tbody = document.getElementById("sales-calling-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  salesCallingData.forEach((row, index) => {
    const tr = document.createElement("tr");
    
    // Compile calling sheet status options
    const options = [
      "Not Called", "Not Connected", "Connected", "Busy", "Switched Off", 
      "Wrong Number", "Not Interested", "Call Back Later", "Screenshot Shared", 
      "Prospect Generated", "Follow Up Required", "Sales Call Done", 
      "Connected Sales Call", "Payment Link Shared", "Deal Closed", 
      "Payment Pending", "Lost"
    ];
    
    let selectOptions = "";
    options.forEach(opt => {
      const selected = row.status === opt ? "selected" : "";
      selectOptions += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--primary-navy);">${row.name}</td>
      <td>${row.contact}</td>
      <td>${row.college}</td>
      <td>${row.branch}</td>
      <td>${row.year}</td>
      <td>
        <select class="table-select sales-status-dropdown" data-row-index="${index}">
          ${selectOptions}
        </select>
      </td>
      <td class="last-updated-cell" style="font-size: 0.775rem; color: var(--text-muted);">${row.updated}</td>
      <td>
        <input type="text" class="table-input sales-remarks-input" data-row-index="${index}" value="${row.remarks}" placeholder="Enter calling details...">
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind Calling status dropdown change event triggers
  document.querySelectorAll(".sales-status-dropdown").forEach(dropdown => {
    dropdown.addEventListener("change", (e) => {
      const idx = e.target.getAttribute("data-row-index");
      const newStatus = e.target.value;
      const oldStatus = salesCallingData[idx].status;
      
      salesCallingData[idx].status = newStatus;
      
      // Update Timestamp
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      salesCallingData[idx].updated = timeStr;
      
      // Target last-updated column in DOM row
      const tr = e.target.closest("tr");
      tr.querySelector(".last-updated-cell").innerText = timeStr;
      
      // Simulated: Synchronizing status change immediately into KPI Board for Sana Ali
      syncBdaStatusChangeToKpiBoard("Sana Ali", oldStatus, newStatus);
      
      showToast(`Logged status: "${newStatus}" for customer ${salesCallingData[idx].name}`);
    });
  });

  // Bind Remarks update triggers
  document.querySelectorAll(".sales-remarks-input").forEach(input => {
    input.addEventListener("blur", (e) => {
      const idx = e.target.getAttribute("data-row-index");
      salesCallingData[idx].remarks = e.target.value;
      showToast(`Remarks updated for ${salesCallingData[idx].name}`);
    });
  });
}

// Sub routine: updates KPI numbers for Sana Ali dynamically based on call log sheet drops
function syncBdaStatusChangeToKpiBoard(bdaName, oldStatus, newStatus) {
  const row = kpiBoardData.find(b => b.name === bdaName);
  if (!row) return;

  // Increment Morning/Evening calls and connects
  row.mCalls += 1;
  row.totalSales = row.mCalls + row.eCalls;

  if (newStatus === "Connected" || newStatus === "Connected Sales Call" || newStatus === "Deal Closed" || newStatus === "Prospect Generated") {
    row.mConn += 1;
    row.connSales = row.mConn + row.eConn;
  }

  // Update Specific outcomes
  if (newStatus === "Screenshot Shared") {
    row.mSS += 1;
  } else if (newStatus === "Prospect Generated") {
    row.mPros += 1;
    row.totalPros = row.mPros + row.ePros;
  } else if (newStatus === "Payment Link Shared") {
    row.pLink += 1;
  } else if (newStatus === "Deal Closed") {
    row.deals += 1;
    row.performance = Math.min(100, row.performance + 3);
  } else if (newStatus === "Follow Up Required") {
    row.followups += 1;
  }

  // Update Status Tag
  if (row.performance >= 90) row.status = "Excellent";
  else if (row.performance >= 70) row.status = "Good";
  else if (row.performance >= 45) row.status = "Average";

  // Re-render Board
  renderKpiBoard();
  initializeCharts();
}

// 7. Follow Ups Table populator
function renderFollowUps() {
  const tbody = document.getElementById("follow-ups-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  const statusFilter = document.getElementById("follow-ups-status-filter").value;

  const rows = followUpsData.filter(row => {
    // If status filter set
    if (statusFilter !== "All") {
      if (statusFilter === "Due Today" && !row.date.includes("Today")) return false;
      if (statusFilter === "Overdue" && !row.date.includes("Overdue")) return false;
      if (statusFilter === "Upcoming" && !row.date.includes("Upcoming")) return false;
    }
    
    // BDA access restriction
    if (currentRole === "BDA" && row.bda !== "Sana Ali") return false;
    
    return true;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No follow-ups scheduled under this filter.</td></tr>`;
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    
    // Pick badge for follow-up date
    let badgeClass = "badge no-update";
    if (row.date.includes("Today")) badgeClass = "badge excellent";
    else if (row.date.includes("Overdue")) badgeClass = "badge high";
    else if (row.date.includes("Upcoming")) badgeClass = "badge good";
    
    // Priority badge
    let priorityClass = "badge medium";
    if (row.priority === "High") priorityClass = "badge high";
    else if (row.priority === "Low") priorityClass = "badge low";

    tr.innerHTML = `
      <td><span class="${badgeClass}">${row.date}</span></td>
      <td>${row.bda}</td>
      <td style="font-weight: 600; color: var(--primary-navy);">${row.customer}</td>
      <td>${row.contact}</td>
      <td>${row.college}</td>
      <td>${row.leadStatus}</td>
      <td><span class="${priorityClass}">${row.priority}</span></td>
      <td>${row.remarks}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="callCustomerSimulate('${row.customer}', ${index})">
          <i data-lucide="phone-call" style="width: 12px; height: 12px; display: inline-block;"></i> Call
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function callCustomerSimulate(name, index) {
  showToast(`Initiating outbound dial to ${name}...`);
  setTimeout(() => {
    const confirmClose = confirm(`Dialing Successful to ${name}.\nDid you close the deal or set another callback date?`);
    if (confirmClose) {
      followUpsData.splice(index, 1);
      renderFollowUps();
      showToast(`Follow-up checklist updated for ${name}.`);
    }
  }, 500);
}

// Bind follow-up filters
const fUpFilter = document.getElementById("follow-ups-status-filter");
if (fUpFilter) {
  fUpFilter.addEventListener("change", renderFollowUps);
}

// 8. HR Desk Requests Table
function renderHRDesk() {
  const tbody = document.getElementById("hr-leaves-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  leaveRequestsData.forEach((row, index) => {
    const tr = document.createElement("tr");
    
    let statusClass = "pending";
    if (row.status === "Approved") statusClass = "approved";
    else if (row.status === "Rejected") statusClass = "rejected";
    
    tr.innerHTML = `
      <td style="font-weight: 600;">${row.empId}</td>
      <td style="font-weight: 600; color: var(--primary-navy);">${row.name}</td>
      <td>${row.role}</td>
      <td>${row.type}</td>
      <td>${row.from}</td>
      <td>${row.to}</td>
      <td>${row.reason}</td>
      <td><span class="badge ${statusClass}">${row.status}</span></td>
      <td>
        ${row.status === "Pending" ? `
          <button class="btn btn-primary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; background: var(--success); border: none;" onclick="updateLeaveRequest(${index}, 'Approved')">Approve</button>
          <button class="btn btn-danger" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="updateLeaveRequest(${index}, 'Rejected')">Reject</button>
        ` : `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No Action Pending</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateLeaveRequest(index, status) {
  leaveRequestsData[index].status = status;
  renderHRDesk();
  showToast(`Leave request for ${leaveRequestsData[index].name} has been ${status}!`);
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const msgSpan = document.getElementById("toast-message");
  
  msgSpan.innerText = message;
  
  const icon = toast.querySelector(".toast-icon");
  if (isError) {
    icon.style.color = "var(--danger)";
    icon.setAttribute("data-lucide", "alert-circle");
  } else {
    icon.style.color = "var(--success)";
    icon.setAttribute("data-lucide", "check-circle");
  }
  
  lucide.createIcons();
  
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Make showToast accessible globally
window.showToast = showToast;

// ==========================================================================
// DATA VISUALIZATION (CHART.JS CONFIG)
// ==========================================================================

function initializeCharts() {
  // Guard clause if canvases are not visible/rendered
  const lineCanvas = document.getElementById("dashboard-line-chart");
  if (!lineCanvas) return;
  
  // Clean existing Chart.js instances before reloading to prevent memory overflow
  Object.keys(charts).forEach(key => {
    if (charts[key]) {
      charts[key].destroy();
    }
  });

  const chartThemeColors = {
    primary: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    coral: "#f97316",
    grid: "#e2e8f0"
  };

  // 1. Dashboard Line Chart (Daily Call Trends)
  const ctxLine = lineCanvas.getContext("2d");
  charts.dashboardLine = new Chart(ctxLine, {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "Marketing Calls",
          data: [420, 510, 480, 550, 610, 450, 240],
          borderColor: chartThemeColors.primary,
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          fill: true,
          tension: 0.4,
          borderWidth: 3
        },
        {
          label: "Prospects Generated",
          data: [32, 45, 41, 52, 59, 38, 12],
          borderColor: chartThemeColors.warning,
          backgroundColor: "transparent",
          tension: 0.4,
          borderWidth: 2,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { family: "Plus Jakarta Sans", weight: 600 } } }
      },
      scales: {
        y: { grid: { color: chartThemeColors.grid }, ticks: { font: { family: "Plus Jakarta Sans" } } },
        x: { grid: { display: false }, ticks: { font: { family: "Plus Jakarta Sans" } } }
      }
    }
  });

  // 2. Dashboard Bar Chart (Team Comparison)
  const ctxBar = document.getElementById("dashboard-bar-chart").getContext("2d");
  charts.dashboardBar = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"],
      datasets: [
        {
          label: "Total Calls Made",
          data: [278, 320, 180, 246],
          backgroundColor: chartThemeColors.primary,
          borderRadius: 6
        },
        {
          label: "Connected Calls",
          data: [119, 151, 67, 98],
          backgroundColor: chartThemeColors.success,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { family: "Plus Jakarta Sans", weight: 600 } } }
      },
      scales: {
        y: { grid: { color: chartThemeColors.grid }, ticks: { font: { family: "Plus Jakarta Sans" } } },
        x: { grid: { display: false }, ticks: { font: { family: "Plus Jakarta Sans" } } }
      }
    }
  });

  // Check if we are on the Reports view before building secondary analytics charts
  const reportsCallsCanvas = document.getElementById("reports-team-calls-chart");
  if (!reportsCallsCanvas) return;

  // 3. Reports: Call Distribution by Team
  const ctxRepCalls = reportsCallsCanvas.getContext("2d");
  charts.repCalls = new Chart(ctxRepCalls, {
    type: "bar",
    data: {
      labels: ["Alpha", "Beta", "Gamma", "Delta"],
      datasets: [{
        label: "Weekly Total Calls",
        data: [1420, 1680, 980, 1250],
        backgroundColor: [chartThemeColors.primary, chartThemeColors.success, chartThemeColors.purple, chartThemeColors.coral],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: chartThemeColors.grid } },
        x: { grid: { display: false } }
      }
    }
  });

  // 4. Reports: Prospects Conversion Trend (Last 7 Days)
  const ctxRepPros = document.getElementById("reports-prospects-chart").getContext("2d");
  charts.repPros = new Chart(ctxRepPros, {
    type: "line",
    data: {
      labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
      datasets: [{
        label: "Conversion Target",
        data: [25, 25, 25, 25, 25, 25, 25],
        borderColor: chartThemeColors.danger,
        borderWidth: 1,
        borderDash: [6, 6],
        fill: false,
        pointStyle: 'none'
      }, {
        label: "Actual Prospects",
        data: [18, 30, 22, 28, 35, 26, 31],
        borderColor: chartThemeColors.success,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: { grid: { color: chartThemeColors.grid } },
        x: { grid: { display: false } }
      }
    }
  });

  // 5. Reports: Revenue & Deals Trend
  const ctxRepRev = document.getElementById("reports-revenue-deals-chart").getContext("2d");
  charts.repRev = new Chart(ctxRepRev, {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        label: "Deals Closed",
        data: [4, 6, 5, 8, 9, 4, 2],
        borderColor: chartThemeColors.purple,
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: chartThemeColors.purple
      }, {
        label: "Revenue generated (in Lakhs)",
        data: [0.5, 0.75, 0.6, 1.0, 1.2, 0.5, 0.2],
        borderColor: chartThemeColors.coral,
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: chartThemeColors.coral
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: { grid: { color: chartThemeColors.grid } },
        x: { grid: { display: false } }
      }
    }
  });

  // 6. Reports: Doughnut Connection Rate
  const ctxDoughnut = document.getElementById("reports-connection-doughnut").getContext("2d");
  charts.repDoughnut = new Chart(ctxDoughnut, {
    type: "doughnut",
    data: {
      labels: ["Connected", "Busy", "Unreachable / Switched Off", "Not Answered"],
      datasets: [{
        data: [43.7, 18.5, 15.2, 22.6],
        backgroundColor: [chartThemeColors.success, chartThemeColors.warning, chartThemeColors.danger, chartThemeColors.primary],
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } }
      }
    }
  });
}

// Complaint Log Table Renderers
function renderComplaintsTable() {
  const adminTbody = document.getElementById("admin-complaints-tbody");
  const hrTbody = document.getElementById("hr-complaints-tbody");

  // Render Admin View (All complaints)
  if (adminTbody) {
    adminTbody.innerHTML = "";
    if (complaintsData.length === 0) {
      adminTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No complaints registered.</td></tr>`;
    } else {
      complaintsData.forEach((row, index) => {
        const tr = document.createElement("tr");
        const statusClass = row.status === "Resolved" ? "approved" : "pending";
        tr.innerHTML = `
          <td>${row.timestamp}</td>
          <td style="font-weight: 600; color: var(--primary-navy);">${row.bdaName}</td>
          <td><span class="badge good">${row.to}</span></td>
          <td style="font-weight: 600;">${row.subject}</td>
          <td style="white-space: normal; min-width: 200px;">${row.details}</td>
          <td><span class="badge ${statusClass}">${row.status}</span></td>
          <td>
            ${row.status === "Pending" ? `
              <button class="btn btn-primary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; background: var(--success); border: none;" onclick="resolveComplaint(${index})">Resolve</button>
            ` : `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Resolved</span>`}
          </td>
        `;
        adminTbody.appendChild(tr);
      });
    }
  }

  // Render HR View (Complaints directed to HR or Team Lead)
  if (hrTbody) {
    hrTbody.innerHTML = "";
    const hrRows = complaintsData.filter(row => row.to === "HR" || row.to === "Team Lead");
    
    if (hrRows.length === 0) {
      hrTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No complaints registered.</td></tr>`;
    } else {
      complaintsData.forEach((row, index) => {
        if (row.to !== "HR" && row.to !== "Team Lead") return;
        
        const tr = document.createElement("tr");
        const statusClass = row.status === "Resolved" ? "approved" : "pending";
        tr.innerHTML = `
          <td>${row.timestamp}</td>
          <td style="font-weight: 600; color: var(--primary-navy);">${row.bdaName}</td>
          <td><span class="badge good">${row.to}</span></td>
          <td style="font-weight: 600;">${row.subject}</td>
          <td style="white-space: normal; min-width: 200px;">${row.details}</td>
          <td><span class="badge ${statusClass}">${row.status}</span></td>
          <td>
            ${row.status === "Pending" ? `
              <button class="btn btn-primary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; background: var(--success); border: none;" onclick="resolveComplaint(${index})">Resolve</button>
            ` : `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Resolved</span>`}
          </td>
        `;
        hrTbody.appendChild(tr);
      });
    }
  }
}

function resolveComplaint(index) {
  complaintsData[index].status = "Resolved";
  renderComplaintsTable();
  showToast("Complaint marked as Resolved!");
}

window.resolveComplaint = resolveComplaint;


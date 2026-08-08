const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./server/config');
const { initDb } = require('./server/db/init');

// Route Imports
const authRoutes = require('./server/routes/auth');
const employeeRoutes = require('./server/routes/employees');
const kpiRoutes = require('./server/routes/kpi');
const callingRoutes = require('./server/routes/calling');
const followupRoutes = require('./server/routes/followups');
const leaveRoutes = require('./server/routes/leaves');
const complaintRoutes = require('./server/routes/complaints');
const teamLeadRoutes = require('./server/routes/teamLead');
const prospectRoutes = require('./server/routes/prospects');
const notificationRoutes = require('./server/routes/notifications');
const settingsRoutes = require('./server/routes/settings');
const reportsRoutes = require('./server/routes/reports');
const hrRoutes = require('./server/routes/hr');

const app = express();

// Middlewares — allow the Render URL and local dev
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:5000'];
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || corsOrigins.some(o => origin.startsWith(o.replace(/\/+$/, '')))) return cb(null, true);
    return cb(null, true); // allow all in dev — tighten for production
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Static files for production build (Vite dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Health check for Render
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// API Routes registration
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/team-lead', teamLeadRoutes);
app.use('/api/prospects', prospectRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/hr', hrRoutes);

// Fallback for SPA Routing in Production
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Database & Server Startup
async function startServer() {
  try {
    await initDb();
    
    // Start Google Sheets Cron Scheduler
    try {
      const sheetsSync = require('./server/services/sheetsSync');
      if (typeof sheetsSync.startCronScheduler === 'function') {
        sheetsSync.startCronScheduler();
      }
    } catch (err) {
      console.warn('Sheets sync service cron not started:', err.message);
    }

    // End-of-Day cron at 7:00 PM daily
    try {
      const cron = require('node-cron');
      const { runEndOfDay } = require('./server/services/endOfDay');
      cron.schedule('0 19 * * *', () => {
        console.log('[Cron] Running end-of-day process...');
        runEndOfDay().catch(e => console.error('[Cron] EOD failed:', e.message));
      });
      console.log('Cron set for 7:00 PM daily (EOD process).');
    } catch (err) {
      console.warn('EOD cron not started:', err.message);
    }

    app.listen(config.PORT, () => {
      console.log(`Server running on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application database:', error);
    process.exit(1);
  }
}

startServer();

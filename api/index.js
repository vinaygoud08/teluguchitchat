import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Health & Diagnostic check endpoints
const supabase = require('../backend/supabaseClient');

const getHealthStatus = async () => {
  const envStatus = {
    has_SUPABASE_URL: !!process.env.SUPABASE_URL,
    has_SUPABASE_KEY: !!process.env.SUPABASE_KEY,
    has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_JWT_SECRET: !!process.env.JWT_SECRET,
    has_GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
  };

  let dbStatus = 'testing';
  let dbError = null;
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      dbStatus = 'error';
      dbError = error.message;
    } else {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = 'exception';
    dbError = err.message;
  }

  return {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    serverless: true,
    time: new Date().toISOString(),
    env: envStatus,
    database: {
      status: dbStatus,
      error: dbError
    }
  };
};

app.get('/health', async (req, res) => {
  const data = await getHealthStatus();
  res.json(data);
});
app.get('/api/health', async (req, res) => {
  const data = await getHealthStatus();
  res.json(data);
});

// Mount routes with /api prefix
app.use('/api/users', require('../backend/routes/user'));
app.use('/api/auth', require('../backend/routes/auth'));
app.use('/api/messages', require('../backend/routes/messages'));
app.use('/api/media', require('../backend/routes/media'));
app.use('/api/groups', require('../backend/routes/groups'));
app.use('/api/ai', require('../backend/routes/ai'));
app.use('/api/version', require('../backend/routes/version'));

// Mount routes without /api prefix
app.use('/users', require('../backend/routes/user'));
app.use('/auth', require('../backend/routes/auth'));
app.use('/messages', require('../backend/routes/messages'));
app.use('/media', require('../backend/routes/media'));
app.use('/groups', require('../backend/routes/groups'));
app.use('/ai', require('../backend/routes/ai'));
app.use('/version', require('../backend/routes/version'));

// Request Logger
app.use((req, res, next) => {
  console.log(`[Vercel Serverless] ${req.method} ${req.url} (originalUrl: ${req.originalUrl})`);
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Serverless Global Error:', err);
  res.status(err.status || 500).json({
    msg: err.message || 'Internal Server Error'
  });
});

export default function handler(req, res) {
  return app(req, res);
}



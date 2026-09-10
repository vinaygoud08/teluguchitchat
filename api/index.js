const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, time: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, time: new Date().toISOString() });
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Serverless Global Error:', err);
  res.status(err.status || 500).json({
    msg: err.message || 'Internal Server Error'
  });
});

module.exports = app;

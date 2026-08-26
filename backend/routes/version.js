const express = require('express');
const router = express.Router();

const LATEST_RELEASE = {
  version: '2.4.0',
  buildNumber: 24,
  releaseDate: 'August 26, 2026',
  title: 'Chit Chat Telugu v2.4.0 — Super AI & Responsive Update 🚀',
  changelog: [
    '🤖 Full-Screen Telugu & English AI Assistant (Meta AI style)',
    '💬 Natural message layout & bubble expansion (no awkward line dividing)',
    '📱 Screen-friendly responsive design for Mobile, Tablet & Desktop',
    '🖼️ Clickable Profile Photo Viewer with full-screen zoom',
    '🔒 Supabase Auth sync for instant registration & profile data retention',
    '⚡ Ultra low-latency WebRTC Audio & Video Calling',
    '🎥 24-Hour Video Stories & Profile Songs player',
    '✨ Enhanced performance, dark theme, and fluid animations'
  ],
  mandatory: false
};

// GET /api/version/check
router.get('/check', (req, res) => {
  const clientVersion = req.query.clientVersion || '1.0.0';
  const hasUpdate = clientVersion !== LATEST_RELEASE.version;

  res.json({
    ...LATEST_RELEASE,
    clientVersion,
    updateAvailable: hasUpdate
  });
});

module.exports = router;

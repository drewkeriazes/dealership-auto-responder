require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const { getAuthUrl, handleAuthCallback, getUnreadEmails, sendReply, markAsHandled, isConnected } = require('./gmail');
const { classifyEmail, draftReply } = require('./claude');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const LOG_PATH = path.join(__dirname, 'email_log.json');

// ── In-memory state ──────────────────────────────────────────────────────────
let pendingQueue = [];
let lastCheck = null;
let checkInProgress = false;
let lastManualCheck = 0; // timestamp for rate-limiting /api/check-now

// ── Log helpers ──────────────────────────────────────────────────────────────
function readLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function appendLog(entry) {
  const log = readLog();
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function isAlreadyQueued(emailId) {
  return pendingQueue.some((item) => item.originalEmail.id === emailId);
}

function isAlreadyLogged(emailId) {
  return readLog().some((entry) => entry.id === emailId);
}

// ── Inbox check logic ────────────────────────────────────────────────────────
async function checkInbox() {
  if (checkInProgress) return;
  checkInProgress = true;
  lastCheck = new Date().toISOString();

  try {
    const emails = await getUnreadEmails();

    for (const email of emails) {
      if (isAlreadyQueued(email.id) || isAlreadyLogged(email.id)) continue;

      let classification;
      try {
        classification = await classifyEmail(email.body, email.subject);
      } catch (err) {
        console.error(`Classification failed for ${email.id}:`, err.message);
        classification = { category: 'NEEDS_HUMAN', confidence: 0, summary: 'Classification error.' };
      }

      // Skip obvious non-customer emails silently
      if (classification.category === 'NOT_A_CUSTOMER') {
        appendLog({
          id: email.id,
          from: email.from,
          fromName: email.fromName,
          subject: email.subject,
          receivedAt: email.receivedAt,
          category: classification.category,
          confidence: classification.confidence,
          action: 'SKIPPED',
          replySentAt: new Date().toISOString(),
          replyBody: '',
        });
        continue;
      }

      let draft;
      try {
        draft = await draftReply(email.body, email.subject, email.fromName, classification.category);
      } catch (err) {
        console.error(`Draft failed for ${email.id}:`, err.message);
        draft = {
          subject: `Re: ${email.subject}`,
          body: "Thank you for reaching out! Please give us a call and we'd be happy to help.",
          suggested_action: 'NEEDS_REVIEW',
          reason: 'Draft generation failed — please write a reply manually.',
        };
      }

      // Override suggested_action if NEEDS_HUMAN or low confidence
      if (classification.category === 'NEEDS_HUMAN' || classification.confidence < 70) {
        draft.suggested_action = 'NEEDS_REVIEW';
        if (!draft.reason) draft.reason = 'Low confidence or flagged category — please review.';
      }

      pendingQueue.push({
        id: uuidv4(),
        originalEmail: email,
        draftReply: draft,
        category: classification.category,
        confidence: classification.confidence,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Inbox check error:', err.message);
  } finally {
    checkInProgress = false;
  }
}

// ── Security: block direct access to sensitive files ─────────────────────────
app.use((req, res, next) => {
  const blocked = ['/tokens.json', '/.env', '/email_log.json'];
  if (blocked.includes(req.path)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.get('/auth/start', (req, res) => {
  res.redirect(getAuthUrl());
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code.');
  try {
    await handleAuthCallback(code);
    res.redirect('/');
  } catch (err) {
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    connected: isConnected(),
    lastCheck,
    pendingCount: pendingQueue.length,
  });
});

app.get('/api/queue', (req, res) => {
  res.json(pendingQueue);
});

app.post('/api/approve/:id', async (req, res) => {
  const item = pendingQueue.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const bodyOverride = req.body && req.body.body ? req.body.body : item.draftReply.body;

  try {
    await sendReply(item.originalEmail.threadId, item.originalEmail.from, item.draftReply.subject, bodyOverride);
    await markAsHandled(item.originalEmail.id);

    appendLog({
      id: item.originalEmail.id,
      from: item.originalEmail.from,
      fromName: item.originalEmail.fromName,
      subject: item.originalEmail.subject,
      receivedAt: item.originalEmail.receivedAt,
      category: item.category,
      confidence: item.confidence,
      action: 'SENT',
      replySentAt: new Date().toISOString(),
      replyBody: bodyOverride,
    });

    pendingQueue = pendingQueue.filter((i) => i.id !== req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skip/:id', (req, res) => {
  const item = pendingQueue.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  appendLog({
    id: item.originalEmail.id,
    from: item.originalEmail.from,
    fromName: item.originalEmail.fromName,
    subject: item.originalEmail.subject,
    receivedAt: item.originalEmail.receivedAt,
    category: item.category,
    confidence: item.confidence,
    action: 'SKIPPED',
    replySentAt: new Date().toISOString(),
    replyBody: '',
  });

  pendingQueue = pendingQueue.filter((i) => i.id !== req.params.id);
  res.json({ success: true });
});

app.get('/api/log', (req, res) => {
  const log = readLog();
  res.json(log.slice(-50).reverse());
});

app.post('/api/check-now', async (req, res) => {
  const now = Date.now();
  if (now - lastManualCheck < 60000) {
    return res.status(429).json({ error: 'Please wait at least 60 seconds between manual checks.' });
  }
  if (!isConnected()) {
    return res.status(400).json({ error: 'Gmail is not connected.' });
  }
  lastManualCheck = now;
  checkInbox(); // fire and forget
  res.json({ success: true, message: 'Inbox check started.' });
});

// ── Serve frontend ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Startup ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const INTERVAL = parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 10;

app.listen(PORT, () => {
  console.log(`\nDealership Email Assistant running at http://localhost:${PORT}`);
  console.log(`Inbox will be checked every ${INTERVAL} minutes.`);
  if (!isConnected()) {
    console.log(`\nGmail not connected yet. Visit http://localhost:${PORT} and click "Connect Gmail".`);
  }
});

// Schedule recurring inbox check
cron.schedule(`*/${INTERVAL} * * * *`, () => {
  if (isConnected()) {
    console.log(`[${new Date().toLocaleTimeString()}] Checking inbox...`);
    checkInbox();
  }
});

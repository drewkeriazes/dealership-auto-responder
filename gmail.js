const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKENS_PATH = path.join(__dirname, 'tokens.json');
const LOG_PATH = path.join(__dirname, 'email_log.json');

const SKIP_SENDERS = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster'];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function getAuthClient() {
  const oauth2Client = getOAuth2Client();
  const tokens = loadTokens();
  if (!tokens) return null;
  oauth2Client.setCredentials(tokens);
  // Auto-save refreshed tokens
  oauth2Client.on('tokens', (newTokens) => {
    const existing = loadTokens() || {};
    saveTokens({ ...existing, ...newTokens });
  });
  return oauth2Client;
}

function isConnected() {
  return loadTokens() !== null;
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });
}

async function handleAuthCallback(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  saveTokens(tokens);
}

function getLoggedIds() {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  try {
    const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    return new Set(log.map((e) => e.id));
  } catch {
    return new Set();
  }
}

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractBody(payload) {
  if (!payload) return '';

  // Single-part plain text
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }

  // Multipart: prefer text/plain, fall back to text/html stripped
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (plain && plain.body && plain.body.data) {
      return decodeBase64(plain.body.data);
    }
    const html = payload.parts.find((p) => p.mimeType === 'text/html');
    if (html && html.body && html.body.data) {
      // Strip HTML tags for a plain-text approximation
      return decodeBase64(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }

  return '';
}

async function getUnreadEmails() {
  const auth = getAuthClient();
  if (!auth) return [];

  const gmail = google.gmail({ version: 'v1', auth });
  const loggedIds = getLoggedIds();

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: 20,
  });

  const messages = listRes.data.messages || [];
  const emails = [];

  for (const msg of messages) {
    if (loggedIds.has(msg.id)) continue;

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    });

    const headers = full.data.payload.headers || [];
    const getHeader = (name) => (headers.find((h) => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

    const fromRaw = getHeader('From');
    const fromEmail = (fromRaw.match(/<(.+?)>/) || [])[1] || fromRaw;
    const fromName = (fromRaw.match(/^(.+?)\s*</) || [])[1]?.replace(/"/g, '').trim() || fromEmail;

    // Skip automated senders
    const fromLower = fromEmail.toLowerCase();
    if (SKIP_SENDERS.some((s) => fromLower.includes(s))) continue;

    const subject = getHeader('Subject') || '(no subject)';
    const dateHeader = getHeader('Date');
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
    const body = extractBody(full.data.payload);

    emails.push({
      id: msg.id,
      threadId: msg.threadId,
      from: fromEmail,
      fromName,
      subject,
      body,
      receivedAt,
    });
  }

  return emails;
}

async function sendReply(threadId, to, subject, body) {
  const auth = getAuthClient();
  if (!auth) throw new Error('Gmail not connected');

  const gmail = google.gmail({ version: 'v1', auth });

  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

  // Get thread to find the Message-ID for proper threading
  let inReplyTo = '';
  try {
    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId });
    const lastMsg = thread.data.messages[thread.data.messages.length - 1];
    const headers = lastMsg.payload.headers || [];
    inReplyTo = (headers.find((h) => h.name.toLowerCase() === 'message-id') || {}).value || '';
  } catch {
    // Threading headers optional
  }

  const emailLines = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
  ];
  if (inReplyTo) {
    emailLines.push(`In-Reply-To: ${inReplyTo}`);
    emailLines.push(`References: ${inReplyTo}`);
  }
  emailLines.push('', body);

  const raw = Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  });
}

async function markAsHandled(messageId) {
  const auth = getAuthClient();
  if (!auth) return;

  const gmail = google.gmail({ version: 'v1', auth });

  // Find or create the "AI-Handled" label
  let labelId;
  try {
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    const existing = (labelsRes.data.labels || []).find((l) => l.name === 'AI-Handled');
    if (existing) {
      labelId = existing.id;
    } else {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'AI-Handled',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      labelId = created.data.id;
    }
  } catch {
    return; // Label marking is best-effort
  }

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch {
    // Best-effort
  }
}

module.exports = { getAuthUrl, handleAuthCallback, getUnreadEmails, sendReply, markAsHandled, isConnected };

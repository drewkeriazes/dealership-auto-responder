// Dealership Email Assistant — Frontend

let currentQueue = [];

// ── Utilities ────────────────────────────────────────────────────────────────
function showToast(message, color) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = color || '#27ae60';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function formatTimestamp(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString();
}

function categoryLabel(cat) {
  const map = {
    VEHICLE_INQUIRY: 'Vehicle Inquiry',
    APPOINTMENT_REQUEST: 'Appointment Request',
    PRICE_QUESTION: 'Price Question',
    TRADE_IN: 'Trade-In',
    FOLLOW_UP: 'Follow-Up',
    GENERAL_QUESTION: 'General Question',
    NOT_A_CUSTOMER: 'Not a Customer',
    NEEDS_HUMAN: 'Needs Human Review',
  };
  return map[cat] || cat;
}

// ── Status polling ────────────────────────────────────────────────────────────
async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const badge = document.getElementById('connection-badge');
    const banner = document.getElementById('connect-banner');

    if (data.connected) {
      badge.textContent = 'Connected';
      badge.className = 'connected';
      banner.style.display = 'none';
    } else {
      badge.textContent = 'Not Connected';
      badge.className = 'disconnected';
      banner.style.display = 'flex';
    }

    document.getElementById('last-check-text').textContent =
      data.lastCheck ? `Last check: ${timeAgo(data.lastCheck)}` : 'Last check: —';
  } catch {
    // ignore network errors
  }
}

// ── Queue rendering ───────────────────────────────────────────────────────────
function renderQueue(items) {
  const container = document.getElementById('queue-container');
  const heading = document.getElementById('queue-heading');

  heading.textContent = items.length > 0
    ? `Needs Your Attention (${items.length})`
    : 'Needs Your Attention';

  if (items.length === 0) {
    container.innerHTML = `
      <div id="empty-state">
        <div class="checkmark">✓</div>
        <p>Nothing needs your attention. Replies are going out automatically.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map((item) => {
    return `
    <div class="email-card needs-review" id="card-${item.id}">
      <div class="review-flag">⚠ This email needs a personal reply from you${item.draftReply.reason ? ' — ' + escapeHtml(item.draftReply.reason) : ''}</div>
      <div class="card-meta">
        <span><strong>From:</strong> ${escapeHtml(item.originalEmail.fromName)} &lt;${escapeHtml(item.originalEmail.from)}&gt;</span>
        <span><strong>Subject:</strong> ${escapeHtml(item.originalEmail.subject)}</span>
        <span><strong>Received:</strong> ${timeAgo(item.originalEmail.receivedAt)}</span>
        <span><strong>Category:</strong> ${categoryLabel(item.category)}</span>
      </div>

      <div class="card-section-label">Original Email</div>
      <div class="original-body">${escapeHtml(item.originalEmail.body)}</div>

      <div class="card-section-label">Suggested Reply — edit before sending</div>
      <textarea class="draft-textarea" id="draft-${item.id}">${escapeHtml(item.draftReply.body)}</textarea>

      <div class="card-actions">
        <button class="btn btn-success" onclick="approveItem('${item.id}')">Send This Reply</button>
        <button class="btn btn-secondary" onclick="skipItem('${item.id}')">Dismiss — I'll Handle It Myself</button>
      </div>
    </div>`;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function refreshQueue() {
  try {
    const res = await fetch('/api/queue');
    currentQueue = await res.json();
    renderQueue(currentQueue);
  } catch {
    // ignore
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function approveItem(id) {
  const card = document.getElementById(`card-${id}`);
  const textarea = document.getElementById(`draft-${id}`);
  const btn = card.querySelector('.btn-success');

  const editedBody = textarea ? textarea.value : '';

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending...';

  try {
    const res = await fetch(`/api/approve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editedBody }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Unknown error');
    }
    card.style.transition = 'opacity 0.3s';
    card.style.opacity = '0';
    setTimeout(() => {
      card.remove();
      currentQueue = currentQueue.filter((i) => i.id !== id);
      renderQueueCount();
      refreshLog();
      showToast('Reply sent!');
    }, 300);
  } catch (err) {
    showToast(`Error: ${err.message}`, '#e74c3c');
    btn.disabled = false;
    btn.textContent = 'Send This Reply';
  }
}

async function skipItem(id) {
  const card = document.getElementById(`card-${id}`);
  const btn = card.querySelector('.btn-secondary');

  btn.disabled = true;
  btn.textContent = 'Skipping...';

  try {
    const res = await fetch(`/api/skip/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed');
    card.style.transition = 'opacity 0.3s';
    card.style.opacity = '0';
    setTimeout(() => {
      card.remove();
      currentQueue = currentQueue.filter((i) => i.id !== id);
      renderQueueCount();
      refreshLog();
    }, 300);
  } catch {
    btn.disabled = false;
    btn.textContent = "Skip — I'll Handle It";
  }
}

function renderQueueCount() {
  const heading = document.getElementById('queue-heading');
  if (currentQueue.length === 0) {
    heading.textContent = 'Needs Your Attention';
    const container = document.getElementById('queue-container');
    container.innerHTML = `
      <div id="empty-state">
        <div class="checkmark">✓</div>
        <p>Nothing needs your attention. Replies are going out automatically.</p>
      </div>`;
  } else {
    heading.textContent = `Needs Your Attention (${currentQueue.length})`;
  }
}

async function checkNow() {
  const btn = document.getElementById('check-now-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Checking...';

  try {
    const res = await fetch('/api/check-now', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    showToast('Checking inbox — customer inquiries will be replied to automatically.');
    // Refresh queue after a short delay
    setTimeout(refreshQueue, 4000);
    setTimeout(refreshQueue, 10000);
  } catch (err) {
    showToast(err.message, '#e74c3c');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Check Inbox Now';
    }, 5000);
  }
}

// ── Activity log ──────────────────────────────────────────────────────────────
async function refreshLog() {
  try {
    const res = await fetch('/api/log');
    const entries = await res.json();
    const container = document.getElementById('log-container');

    const recent = entries.slice(0, 10);

    if (recent.length === 0) {
      container.innerHTML = '<p style="color:#888; font-size:0.9rem;">No activity yet.</p>';
      return;
    }

    container.innerHTML = `
      <table class="log-table">
        <thead>
          <tr>
            <th>From</th>
            <th>Subject</th>
            <th>Category</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map((e) => `
          <tr>
            <td>${escapeHtml(e.fromName || e.from)}</td>
            <td>${escapeHtml(e.subject)}</td>
            <td>${categoryLabel(e.category)}</td>
            <td><span class="badge-${e.action === 'SENT' ? 'sent' : 'skipped'}">${e.action}</span></td>
            <td>${formatTimestamp(e.replySentAt)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch {
    // ignore
  }
}

// ── Init & polling ────────────────────────────────────────────────────────────
refreshStatus();
refreshQueue();
refreshLog();

setInterval(refreshStatus, 30000);
setInterval(refreshQueue, 60000);
setInterval(refreshLog, 60000);

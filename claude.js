const Anthropic = require('@anthropic-ai/sdk');
const { getDealershipContext } = require('./dealership-profile');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function classifyEmail(emailBody, subject) {
  const client = getClient();

  const prompt = `Classify this dealership customer email into ONE of these categories:
- VEHICLE_INQUIRY: asking about a specific vehicle or general inventory
- APPOINTMENT_REQUEST: wants to schedule a visit or test drive
- PRICE_QUESTION: asking about price, financing, or payment
- TRADE_IN: asking about trading in their vehicle
- FOLLOW_UP: checking back after a previous visit or conversation
- GENERAL_QUESTION: hours, location, process questions
- NOT_A_CUSTOMER: spam, vendor pitch, automated email, or irrelevant
- NEEDS_HUMAN: complaint, legal threat, or too complex to auto-handle

Subject: ${subject}

Email body:
${emailBody}

Return ONLY a JSON object with no extra text: { "category": "CATEGORY_NAME", "confidence": 0-100, "summary": "one sentence" }`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  // Strip markdown code fences if present
  const jsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    return { category: 'NEEDS_HUMAN', confidence: 0, summary: 'Could not parse classification response.' };
  }
}

async function draftReply(emailBody, subject, senderName, category) {
  const client = getClient();
  const dealershipContext = getDealershipContext();

  const prompt = `${dealershipContext}

---

A customer has sent the following email. Draft a warm, professional reply.

Customer name: ${senderName}
Email subject: ${subject}
Email category: ${category}

Customer's email:
${emailBody}

---

Instructions:
- Write a complete, ready-to-send email reply
- Follow all tone and style rules from the dealership context above
- Do NOT make up vehicle availability, pricing, or specs
- Invite the customer to call or visit for specifics
- Keep it concise — 3 to 6 sentences is ideal

Return ONLY a JSON object with no extra text:
{
  "subject": "Re: [original subject]",
  "body": "full email body text",
  "suggested_action": "SEND or NEEDS_REVIEW",
  "reason": "brief note if flagged for review, otherwise empty string"
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: dealershipContext,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  const jsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch {
    return {
      subject: `Re: ${subject}`,
      body: 'Thank you for reaching out! Please give us a call and we\'d be happy to help you out.',
      suggested_action: 'NEEDS_REVIEW',
      reason: 'Could not parse Claude response — please review before sending.',
    };
  }
}

module.exports = { classifyEmail, draftReply };

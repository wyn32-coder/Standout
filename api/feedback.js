// api/feedback.js
// Receives feedback from app and sends email via Resend
// Set RESEND_API_KEY in Vercel environment variables

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, context, rating, page } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // If no Resend key, just log and return success (graceful fallback)
  if (!RESEND_API_KEY) {
    console.log('FEEDBACK RECEIVED (no Resend key):', { message, context, rating, page });
    return res.status(200).json({ ok: true });
  }

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' });
  const ratingText = rating === 'up' ? '👍 Positive' : rating === 'down' ? '👎 Negative' : '💬 General';

  const emailBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#f4722b;padding:16px 20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">📬 New Standout Feedback</h2>
  </div>
  <div style="background:#f9f9f9;border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 16px"><strong>Rating:</strong> ${ratingText}</p>
    <p style="margin:0 0 16px"><strong>Page/Tool:</strong> ${page || 'Unknown'}</p>
    ${context ? `<p style="margin:0 0 16px"><strong>Context:</strong> ${context}</p>` : ''}
    <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:16px">
      <p style="margin:0;font-size:16px;line-height:1.6;color:#333">${message.replace(/\n/g, '<br/>')}</p>
    </div>
    <p style="margin:0;font-size:12px;color:#999">Sent: ${timestamp}</p>
  </div>
</div>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Standout Feedback <feedback@standouttoday.com>',
        to: ['hello@standouttoday.com'],
        subject: `${ratingText} Feedback — ${page || 'Standout'} — ${timestamp}`,
        html: emailBody,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      // Still return success to user — don't show errors for feedback
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Feedback send error:', err);
    return res.status(200).json({ ok: true }); // Always succeed from user's perspective
  }
}

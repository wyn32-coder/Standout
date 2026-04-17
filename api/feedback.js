// api/feedback.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, rating, page, context } = req.body;
  if (!message?.trim() && !rating) return res.status(400).json({ error: 'Nothing to send' });

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' });
  const ratingText = rating === 'up' ? '👍 Loving it' : rating === 'down' ? '👎 Needs work' : rating === 'idea' ? '💡 Idea' : '💬 General';

  // ── ALWAYS LOG to Vercel (readable in Vercel dashboard → Functions → Logs) ──
  console.log('=== STANDOUT FEEDBACK ===');
  console.log('Time:', timestamp);
  console.log('Rating:', ratingText);
  console.log('Tool/Page:', page || 'unknown');
  console.log('Message:', message || '(none)');
  console.log('========================');

  // ── EMAIL via Resend if key is set ──
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Standout Feedback <feedback@standouttoday.com>',
          to: ['hello@standouttoday.com'],
          subject: `${ratingText} — ${page || 'Standout'} — ${timestamp}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#f4722b;padding:16px 22px;border-radius:8px 8px 0 0">
                <h2 style="color:#fff;margin:0;font-size:17px">📬 New Standout Feedback</h2>
              </div>
              <div style="background:#f8f8f8;border:1px solid #e8e8e8;border-top:none;padding:22px;border-radius:0 0 8px 8px">
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                  <tr><td style="padding:6px 0;color:#666;width:100px;font-size:13px">Rating</td><td style="padding:6px 0;font-weight:600;font-size:14px">${ratingText}</td></tr>
                  <tr><td style="padding:6px 0;color:#666;font-size:13px">Tool</td><td style="padding:6px 0;font-size:14px">${page || 'unknown'}</td></tr>
                  <tr><td style="padding:6px 0;color:#666;font-size:13px">Time</td><td style="padding:6px 0;font-size:14px">${timestamp}</td></tr>
                </table>
                <div style="background:#fff;border:1px solid #ddd;border-left:4px solid #f4722b;border-radius:6px;padding:16px">
                  <p style="margin:0;font-size:15px;line-height:1.65;color:#222">${(message || '(no message)').replace(/\n/g, '<br/>')}</p>
                </div>
              </div>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Resend error (feedback still logged above):', err.message);
    }
  } else {
    console.log('(RESEND_API_KEY not set — feedback logged above only)');
  }

  return res.status(200).json({ ok: true });
}


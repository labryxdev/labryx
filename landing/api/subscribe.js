export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  try {
    // Send welcome email
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Labryx <hello@labryx.dev>',
        to: [email],
        subject: "You're on the Labryx list 🚀",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; background: #0a0a0f; color: #e2e8f0;">
            <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 1rem;">You're in. 🎉</h1>
            <p style="color: #64748b; margin-bottom: 1.5rem;">Thanks for signing up for Labryx. We'll let you know the moment Pro launches.</p>
            <p style="color: #64748b; margin-bottom: 2rem;">In the meantime, install the free CLI:</p>
            <div style="background: #13131a; border: 1px solid #1e1e2e; border-radius: 8px; padding: 1rem 1.5rem; font-family: monospace; color: #4fd1c5; margin-bottom: 2rem;">
              npm install -g labryx
            </div>
            <p style="color: #64748b; font-size: 0.85rem;">— The Labryx team</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Send failed');

    console.log(`[subscribe] New signup: ${email}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[subscribe] Error:', err.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}

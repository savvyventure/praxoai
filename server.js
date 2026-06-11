// server.js - PraxoAI Backend
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const PORT = process.env.PORT || 4242;

app.use(cors());

// Stripe webhook needs raw body — must be before express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook received');
    console.log('Signature header:', sig ? 'present' : 'MISSING');
    console.log('Webhook secret configured:', webhookSecret ? 'yes' : 'NO - MISSING');
    console.log('Body type:', typeof req.body, Buffer.isBuffer(req.body) ? '(Buffer)' : '(not Buffer)');

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log('Event verified:', event.type);
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object;
        const email = intent.metadata.customer_email;
        const toolId = intent.metadata.tool_id;

        console.log('Payment succeeded - email:', email, 'toolId:', toolId);

        if (email && toolId) {
            try {
                await sendDeliveryEmail(email, toolId, intent.id);
                console.log('Email sent successfully');
            } catch (err) {
                console.error('Email delivery failed:', err.message);
            }
        } else {
            console.log('Missing email or toolId - skipping delivery');
        }
    }

    res.json({ received: true });
});

app.use(express.json());

// ─────────────────────────────────────────
// Tool catalog
// Fill in downloadUrl and licenseKey when ready
// ─────────────────────────────────────────
const tools = {
    deepwork: {
        name: 'DeepWork Timer',
        price: 2900,
        downloadUrl: 'https://PLACEHOLDER_DEEPWORK_DOWNLOAD_URL',
        licenseKey: 'DWT-PLACEHOLDER-XXXX'
    },
    mindmap: {
        name: 'MindMap Pro',
        price: 3900,
        downloadUrl: 'https://PLACEHOLDER_MINDMAP_DOWNLOAD_URL',
        licenseKey: 'MMP-PLACEHOLDER-XXXX'
    },
    habit: {
        name: 'Habit Architect',
        price: 2400,
        downloadUrl: 'https://PLACEHOLDER_HABIT_DOWNLOAD_URL',
        licenseKey: 'HAB-PLACEHOLDER-XXXX'
    },
    focus: {
        name: 'Focus Lens',
        price: 1900,
        downloadUrl: 'https://PLACEHOLDER_FOCUS_DOWNLOAD_URL',
        licenseKey: 'FLS-PLACEHOLDER-XXXX'
    },
    journal: {
        name: 'Daily Journal',
        price: 2200,
        downloadUrl: 'https://PLACEHOLDER_JOURNAL_DOWNLOAD_URL',
        licenseKey: 'DJN-PLACEHOLDER-XXXX'
    },
    planner: {
        name: 'Task Architect',
        price: 3400,
        downloadUrl: 'https://PLACEHOLDER_PLANNER_DOWNLOAD_URL',
        licenseKey: 'TAR-PLACEHOLDER-XXXX'
    },
    quickstart: {
        name: 'QuickStart Kit',
        price: 500,
        downloadUrl: 'https://PLACEHOLDER_QUICKSTART_DOWNLOAD_URL',
        licenseKey: 'QSK-PLACEHOLDER-XXXX'
    },
    bundle: {
        name: 'Complete Bundle',
        price: 9900,
        downloadUrl: 'https://PLACEHOLDER_BUNDLE_DOWNLOAD_URL',
        licenseKey: 'BND-PLACEHOLDER-XXXX'
    }
};

// ─────────────────────────────────────────
// Send delivery email via SendGrid
// ─────────────────────────────────────────
async function sendDeliveryEmail(toEmail, toolId, paymentIntentId) {
    const tool = tools[toolId];
    if (!tool) throw new Error('Unknown tool: ' + toolId);

    const orderId = paymentIntentId.slice(-8).toUpperCase();
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'hello@praxoai.com';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your PraxoAI Purchase</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">

            <!-- Header -->
            <tr>
              <td style="padding:40px 40px 32px;text-align:center;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(34,211,238,0.08));">
                <div style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#22d3ee);border-radius:12px;padding:10px 14px;margin-bottom:16px;">
                  <span style="color:white;font-size:20px;font-weight:700;">⚡</span>
                </div>
                <h1 style="margin:0;color:white;font-size:26px;font-weight:700;">You're all set!</h1>
                <p style="margin:8px 0 0;color:#9ca3af;font-size:15px;">Your ${tool.name} is ready to download</p>
              </td>
            </tr>

            <!-- Download Button -->
            <tr>
              <td style="padding:32px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <a href="${tool.downloadUrl}"
                         style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:white;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;">
                        Download ${tool.name} →
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- License Key Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a25;border-radius:12px;border:1px solid rgba(139,92,246,0.2);">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Your License Key</p>
                      <p style="margin:0;color:#a78bfa;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:0.05em;">${tool.licenseKey}</p>
                      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Keep this safe — you'll need it to activate your tool</p>
                    </td>
                  </tr>
                </table>

                <!-- Order Details -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#1a1a25;border-radius:12px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0 0 12px;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Order Summary</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#9ca3af;font-size:14px;padding:4px 0;">Product</td>
                          <td align="right" style="color:white;font-size:14px;padding:4px 0;">${tool.name}</td>
                        </tr>
                        <tr>
                          <td style="color:#9ca3af;font-size:14px;padding:4px 0;">Order ID</td>
                          <td align="right" style="color:white;font-size:14px;font-family:monospace;padding:4px 0;">${orderId}</td>
                        </tr>
                        <tr>
                          <td style="color:#9ca3af;font-size:14px;padding:4px 0;">Status</td>
                          <td align="right" style="padding:4px 0;"><span style="color:#10b981;font-size:13px;font-weight:600;">✓ Confirmed</span></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:13px;">Questions? Reply to this email or contact <a href="mailto:hello@praxoai.com" style="color:#8b5cf6;text-decoration:none;">hello@praxoai.com</a></p>
                <p style="margin:8px 0 0;color:#4b5563;font-size:12px;">© 2026 PraxoAI. One-time purchase. No recurring charges.</p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
    `;

    await sgMail.send({
        to: toEmail,
        from: fromEmail,
        subject: `Your ${tool.name} is ready to download ⚡`,
        html,
        text: `Your ${tool.name} is ready!\n\nDownload: ${tool.downloadUrl}\nLicense Key: ${tool.licenseKey}\nOrder ID: ${orderId}\n\nQuestions? hello@praxoai.com`
    });

    console.log(`Delivery email sent to ${toEmail} for ${tool.name}`);
}

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

// Serve index.html with Stripe publishable key injected at runtime
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const pk = process.env.STRIPE_PUBLISHABLE_KEY || 'REPLACE_WITH_PK_LIVE';
    html = html.replace('REPLACE_WITH_PK_LIVE', pk);
    res.send(html);
});

// Serve success page
app.get('/success.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// Serve static assets
app.use(express.static(__dirname));

// Create PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { items, email } = req.body;
        let totalAmount = 0;
        for (const item of items) {
            const tool = tools[item.id];
            if (!tool) return res.status(400).json({ error: 'Invalid tool ID' });
            totalAmount += tool.price;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {
                tool_id: items[0].id,
                customer_email: email || ''
            },
            receipt_email: email || undefined
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Payment intent creation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`PraxoAI server running on port ${PORT}`);
});

// server.js - PraxoAI Backend
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4242;

app.use(cors());
app.use(express.json());

// Tool catalog
const tools = {
    deepwork:   { name: 'DeepWork Timer',   price: 2900 },
    mindmap:    { name: 'MindMap Pro',       price: 3900 },
    habit:      { name: 'Habit Architect',   price: 2400 },
    focus:      { name: 'Focus Lens',        price: 1900 },
    journal:    { name: 'Daily Journal',     price: 2200 },
    planner:    { name: 'Task Architect',    price: 3400 },
    quickstart: { name: 'QuickStart Kit',    price: 500  },
    bundle:     { name: 'Complete Bundle',   price: 9900 }
};

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

// Serve other static assets (CSS, JS, fonts if any)
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

// Health check (Railway uses this)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`PraxoAI server running on port ${PORT}`);
});

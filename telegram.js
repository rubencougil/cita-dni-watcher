const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { CONFIG } = require('./config');

async function sendTelegramMessage(text) {
  try {
    // Truncate to Telegram's 4096 char limit and strip special Markdown chars to avoid parse errors
    const safeText = text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&').slice(0, 4096);
    await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: safeText,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
    return true;
  } catch (error) {
    console.error('❌ Error Telegram (Msg):', error.message);
    return false;
  }
}

async function sendScreenshotToTelegram(filePath, caption) {
  try {
    const form = new FormData();
    form.append('chat_id', CONFIG.TELEGRAM_CHAT_ID);
    form.append('photo', fs.createReadStream(filePath));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
    }

    await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`, form, {
      headers: form.getHeaders(),
    });
    console.log('📸 Captura enviada a Telegram.');
  } catch (error) {
    console.error('❌ Error Telegram (Photo):', error.message);
  }
}

module.exports = { sendTelegramMessage, sendScreenshotToTelegram };
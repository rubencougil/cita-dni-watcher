const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

const CONFIG = {
  TELEGRAM_BOT_TOKEN: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  TELEGRAM_CHAT_ID: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  CHECK_INTERVAL_MINUTES: parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 10,
  START_URL: (process.env.CITA_DNI_URL || 'https://sede.administracionespublicas.gob.es/icpplus/index').trim(),
  MAX_MONTH: (process.env.MAX_MONTH || '').trim().toLowerCase()
};

const MONTH_MAP = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

function validateConfig() {
  console.log('📁 Verificando configuración...');
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    console.error('❌ Error: Faltan credenciales de Telegram en el .env');
    process.exit(1);
  }

  console.log('=== CONFIGURACIÓN CARGADA ===');
  console.log('START_URL:', CONFIG.START_URL);
  console.log('MAX_MONTH:', CONFIG.MAX_MONTH || 'SIN FILTRO');
  console.log('==============================\n');
}

module.exports = { CONFIG, MONTH_MAP, validateConfig };
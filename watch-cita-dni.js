const path = require('path');            // Para manejo de rutas de archivos
const fs = require('fs');
const { chromium } = require('playwright');
const readline = require('readline');

const { CONFIG, validateConfig } = require('./config');
const { sendTelegramMessage, sendScreenshotToTelegram } = require('./telegram');
const { parseAvailableMonths, isValidMonthForNotification } = require('./parser');

let browser = null;

validateConfig();

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function cleanup() {
  if (browser) await browser.close();
  process.exit(0);
}

// Manejo de diferentes señales de cierre para asegurar que el navegador se cierre siempre
process.on('SIGINT', async () => {
  await sendTelegramMessage('🛑 Detenido por el usuario.');
  await cleanup();
});

process.on('SIGTERM', async () => {
  await sendTelegramMessage('🛑 Proceso finalizado por el sistema.');
  await cleanup();
});

process.on('SIGBREAK', async () => {
  await cleanup();
});

async function main() {
  browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  console.log(`🌐 Abriendo URL: ${CONFIG.START_URL}`);
  await page.goto(CONFIG.START_URL, { waitUntil: 'domcontentloaded' });

  console.log('\n1) Login manual.\n2) Navega hasta la página de citas.\n3) Regresa aquí.');
  await prompt('\n⏳ Presiona ENTER para empezar...');

  const initialUrl = page.url();
  let previousSnapshot = await page.evaluate(() => document.body.innerText.trim());

  console.log(`✅ Monitorización iniciada (${CONFIG.CHECK_INTERVAL_MINUTES} min).`);
  await sendTelegramMessage('✅ Monitor de citas DNI iniciado correctamente.');

  while (true) {
    try {
      console.log(`🔄 Verificando cambios - ${new Date().toLocaleString()}`);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Esperar a que la página se estabilice tras posibles redirecciones JS
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {
        // networkidle puede agotar tiempo en páginas con polling — no es crítico
      }

      const currentSnapshot = await page.evaluate(() => document.body.innerText.trim());
      const availableMonths = parseAvailableMonths(currentSnapshot);
      const monthsText = availableMonths ? availableMonths.map(m => m.name).join(', ') : 'Ninguno';
      console.log(`📅 Meses detectados: ${monthsText}`);

      if (currentSnapshot !== previousSnapshot) {
        if (availableMonths && !isValidMonthForNotification(availableMonths)) {
          console.log(`⏭️ Ignorado: ${monthsText} posteriores a ${CONFIG.MAX_MONTH}`);
          previousSnapshot = currentSnapshot;
          continue;
        }

        const screenshotPath = path.join(__dirname, `screenshot_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        const caption = `🚨 CAMBIO DETECTADO\n📅 Meses: ${monthsText}`;
        await sendScreenshotToTelegram(screenshotPath, caption);

        setTimeout(() => fs.unlinkSync(screenshotPath), 2000);
        previousSnapshot = currentSnapshot;
      } else {
        console.log('✅ Sin cambios.');
      }
    } catch (e) {
      const isNavigationError = e.message.includes('Execution context was destroyed')
        || e.message.includes('navigation');

      if (isNavigationError) {
        // Error transitorio por redirección de la página — se reintenta en el próximo ciclo
        console.warn(`⚠️ Navegación en curso, se reintentará en el próximo ciclo.`);
      } else {
        console.error('❌ Error:', e.message);
        await sendTelegramMessage(`❌ Error: ${e.message}`);
      }
    }
    await new Promise(r => setTimeout(r, CONFIG.CHECK_INTERVAL_MINUTES * 60000));
  }
}

main().catch(async (e) => {
  console.error('💥 Crítico:', e.message);
  await sendTelegramMessage(`💥 ERROR CRÍTICO: ${e.message}`);
  await cleanup();
});

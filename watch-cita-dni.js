const path = require('path');
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

const RETRY_WAIT_MS = 30000; // espera corta tras error de red antes de reintentar

function isNetworkError(msg) {
  return msg.includes('ERR_TIMED_OUT')
    || msg.includes('ERR_INTERNET_DISCONNECTED')
    || msg.includes('ERR_NETWORK_CHANGED')
    || msg.includes('net::ERR')
    || msg.includes('Execution context was destroyed')
    || msg.includes('navigation')
    || msg.includes('Timeout');
}

const INTERMEDIATE_TITLE = 'Sección de Unidad de Documentación';
const INTERMEDIATE_WAIT_MS = 15000; // tiempo máximo esperando a que desaparezca la página intermedia

async function waitForIntermediatePage(page) {
  const title = await page.title();
  if (!title.includes(INTERMEDIATE_TITLE)) return;

  console.log('⏳ Página intermedia detectada, esperando redirección...');
  try {
    await page.waitForFunction(
      (t) => !document.title.includes(t),
      INTERMEDIATE_TITLE,
      { timeout: INTERMEDIATE_WAIT_MS }
    );
    // Esperar a que la página de destino esté estable
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  } catch {
    console.warn('⚠️ La página intermedia tardó demasiado en redirigir.');
  }
}

async function main() {
  browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  console.log(`🌐 Abriendo URL: ${CONFIG.START_URL}`);
  await page.goto(CONFIG.START_URL, { waitUntil: 'domcontentloaded' });

  console.log('\n1) Login manual.\n2) Navega hasta la página de citas.\n3) Regresa aquí.');
  await prompt('\n⏳ Presiona ENTER para empezar...');

  let previousSnapshot = await page.evaluate(() => document.body.innerText.trim());
  let consecutiveErrors = 0;

  console.log(`✅ Monitorización iniciada (${CONFIG.CHECK_INTERVAL_MINUTES} min).`);
  await sendTelegramMessage('✅ Monitor de citas DNI iniciado correctamente.');

  while (true) {
    try {
      console.log(`🔄 Verificando cambios - ${new Date().toLocaleString()}`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForIntermediatePage(page);

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
      consecutiveErrors = 0;

      if (currentSnapshot !== previousSnapshot) {
        if (availableMonths && !isValidMonthForNotification(availableMonths)) {
          console.log(`⏭️ Ignorado: ${monthsText} posteriores a ${CONFIG.MAX_MONTH}`);
          await sendTelegramMessage(`ℹ️ Citas detectadas en ${monthsText}, pero son posteriores a ${CONFIG.MAX_MONTH}. Seguiré vigilando.`);
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

      await new Promise(r => setTimeout(r, CONFIG.CHECK_INTERVAL_MINUTES * 60000));
    } catch (e) {
      consecutiveErrors++;
      console.error(`❌ Error (${consecutiveErrors}):`, e.message);

      if (isNetworkError(e.message)) {
        console.warn('⚠️ Problema de red o carga, reintentando en 30s...');
        if (consecutiveErrors >= 3) {
          await sendTelegramMessage('⚠️ Llevo varios intentos sin poder cargar la página. Seguiré intentándolo.');
          consecutiveErrors = 0;
        }
        // Reintento rápido en lugar de esperar el intervalo completo
        await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
      } else {
        await sendTelegramMessage('❌ Se ha producido un error inesperado en la monitorización. Comprueba que el proceso sigue activo.');
        consecutiveErrors = 0;
        await new Promise(r => setTimeout(r, CONFIG.CHECK_INTERVAL_MINUTES * 60000));
      }
    }
  }
}

main().catch(async (e) => {
  console.error('💥 Crítico:', e.message);
  await sendTelegramMessage('🚨 El monitor se ha detenido por un error grave. Reinícialo manualmente.');
  await cleanup();
});

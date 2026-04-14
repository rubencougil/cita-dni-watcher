const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const readline = require("readline");

const { CONFIG, validateConfig } = require("./config");
const { sendTelegramMessage, sendScreenshotToTelegram } = require("./telegram");
const {
  parseAvailableMonths,
  isValidMonthForNotification,
} = require("./parser");

let browser = null;
let isCleaningUp = false;

validateConfig();

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

async function cleanup(message) {
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log("\n🛑 Cerrando...");
  if (message) await sendTelegramMessage(message);

  try {
    if (browser) {
      await browser.close();
      browser = null;
    }
  } catch (e) {
    console.error("Error cerrando el navegador:", e.message);
  }

  process.exit(0);
}

// Manejo de diferentes señales de cierre para asegurar que el navegador se cierre siempre
process.on("SIGINT", () => cleanup("🛑 Detenido por el usuario."));
process.on("SIGTERM", () => cleanup("🛑 Proceso finalizado por el sistema."));
process.on("SIGBREAK", () => cleanup());
process.on("exit", () => {
  // Último recurso: forzar cierre del browser si sigue abierto de forma síncrona
  if (browser) {
    try {
      browser.close();
    } catch {}
  }
});

const RETRY_WAIT_MS = 30000; // espera corta tras error de red antes de reintentar
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

const HEARTBEAT_MESSAGES = [
  '👀 Sigo aquí, mirando la página como un halcón. Nada nuevo por el momento, pero no me rindo.',
  '🫡 Parte de situación: sin novedades. La página sigue igual de aburrida que antes. Seguimos en guardia.',
  '🕰️ Ha pasado una hora y las citas siguen sin aparecer. Esto es como esperar el AVE en Chamartín... paciencia.',
  '🤖 Confirmado: el script respira, la conexión funciona y las citas siguen sin existir. Todo en orden, nada que celebrar.',
];

function getRandomHeartbeat() {
  return HEARTBEAT_MESSAGES[Math.floor(Math.random() * HEARTBEAT_MESSAGES.length)];
}

function isNetworkError(msg) {
  return (
    msg.includes("ERR_TIMED_OUT") ||
    msg.includes("ERR_INTERNET_DISCONNECTED") ||
    msg.includes("ERR_NETWORK_CHANGED") ||
    msg.includes("net::ERR") ||
    msg.includes("Execution context was destroyed") ||
    msg.includes("navigation") ||
    msg.includes("Timeout")
  );
}

const INTERMEDIATE_TITLE = "Selección de Unidad de Documentación";
const INTERMEDIATE_WAIT_MS = 20000;

async function waitForIntermediatePage(page) {
  // La redirección puede ocurrir antes de llegar aquí — comprobamos el título con try/catch
  let title = '';
  try { title = await page.title(); } catch { return; }

  if (!title.includes(INTERMEDIATE_TITLE)) return;

  console.log("⏳ Página intermedia detectada, esperando redirección...");
  try {
    // Esperamos a que la navegación a la página de citas se complete
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: INTERMEDIATE_WAIT_MS });
    console.log("✅ Redirección completada.");
  } catch {
    console.warn("⚠️ La página intermedia tardó demasiado en redirigir.");
  }
}

async function main() {
  browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  console.log(`🌐 Abriendo URL: ${CONFIG.START_URL}`);
  await page.goto(CONFIG.START_URL, { waitUntil: "domcontentloaded" });

  console.log(
    "\n1) Login manual.\n2) Navega hasta la página de citas.\n3) Regresa aquí.",
  );
  await prompt("\n⏳ Presiona ENTER para empezar...");

  let previousSnapshot = await page.evaluate(() =>
    document.body.innerText.trim(),
  );
  let consecutiveErrors = 0;
  let lastHeartbeatTime = Date.now();

  console.log(
    `✅ Monitorización iniciada (${CONFIG.CHECK_INTERVAL_MINUTES} min).`,
  );
  await sendTelegramMessage("✅ Monitor de citas DNI iniciado correctamente.");

  while (true) {
    try {
      console.log(`🔄 Verificando cambios - ${new Date().toLocaleString()}`);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForIntermediatePage(page);

      // Esperar a que la página se estabilice tras posibles redirecciones JS
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {
        // networkidle puede agotar tiempo en páginas con polling — no es crítico
      }

      const currentSnapshot = await page.evaluate(() =>
        document.body.innerText.trim(),
      );
      const availableMonths = parseAvailableMonths(currentSnapshot);
      const monthsText = availableMonths
        ? availableMonths.map((m) => m.name).join(", ")
        : "Ninguno";
      console.log(`📅 Meses detectados: ${monthsText}`);
      consecutiveErrors = 0;

      if (currentSnapshot !== previousSnapshot) {
        if (availableMonths && !isValidMonthForNotification(availableMonths)) {
          console.log(
            `⏭️ Ignorado: ${monthsText} posteriores a ${CONFIG.MAX_MONTH}`,
          );
          await sendTelegramMessage(
            `ℹ️ Citas detectadas en ${monthsText}, pero son posteriores a ${CONFIG.MAX_MONTH}. Seguiré vigilando.`,
          );
          previousSnapshot = currentSnapshot;
          continue;
        }

        const screenshotPath = path.join(
          __dirname,
          `screenshot_${Date.now()}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });

        const caption = `🚨 CAMBIO DETECTADO\n📅 Meses: ${monthsText}`;
        await sendScreenshotToTelegram(screenshotPath, caption);

        setTimeout(() => fs.unlinkSync(screenshotPath), 2000);
        previousSnapshot = currentSnapshot;
        lastHeartbeatTime = Date.now();
      } else {
        console.log("✅ Sin cambios.");
        if (Date.now() - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
          await sendTelegramMessage(getRandomHeartbeat());
          lastHeartbeatTime = Date.now();
        }
      }

      await new Promise((r) =>
        setTimeout(r, CONFIG.CHECK_INTERVAL_MINUTES * 60000),
      );
    } catch (e) {
      consecutiveErrors++;
      console.error(`❌ Error (${consecutiveErrors}):`, e.message);

      if (isNetworkError(e.message)) {
        console.warn("⚠️ Problema de red o carga, reintentando en 30s...");
        if (consecutiveErrors >= 3) {
          await sendTelegramMessage(
            "⚠️ Llevo varios intentos sin poder cargar la página. Seguiré intentándolo.",
          );
          consecutiveErrors = 0;
        }
        // Reintento rápido en lugar de esperar el intervalo completo
        await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
      } else {
        await sendTelegramMessage(
          "❌ Se ha producido un error inesperado en la monitorización. Comprueba que el proceso sigue activo.",
        );
        consecutiveErrors = 0;
        await new Promise((r) =>
          setTimeout(r, CONFIG.CHECK_INTERVAL_MINUTES * 60000),
        );
      }
    }
  }
}

main().catch(async (e) => {
  console.error("💥 Crítico:", e.message);
  await cleanup(
    "🚨 El monitor se ha detenido por un error grave. Reinícialo manualmente.",
  );
});

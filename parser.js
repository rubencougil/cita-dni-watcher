const { MONTH_MAP, CONFIG } = require('./config');

function parseAvailableMonths(pageContent) {
  const lowerContent = pageContent.toLowerCase();
  if (lowerContent.includes("no hay citas") || lowerContent.includes("no se han encontrado")) return null;

  const triggerKeywords = ["meses disponibles", "cambiar mes", "dias disponibles", "seleccione el mes"];
  if (!triggerKeywords.some(kw => lowerContent.includes(kw))) return null;

  const months = [];
  for (const [monthName, monthNumber] of Object.entries(MONTH_MAP)) {
    // Quitamos \b para ser más flexibles y usamos una búsqueda que ignore mayúsculas/minúsculas
    const monthRegex = new RegExp(`${monthName}`, 'i');
    if (monthRegex.test(pageContent)) {
      months.push({ name: monthName.charAt(0).toUpperCase() + monthName.slice(1), number: monthNumber });
    }
  }
  
  // Si detectamos palabras clave de citas pero no meses específicos, 
  // devolvemos un log informativo para debuguear.
  if (months.length === 0) {
    console.log('🔍 Se detectó la sección de citas pero no se reconoció el nombre del mes en el texto.');
  }

  return months.length > 0 ? months : null;
}

function isValidMonthForNotification(availableMonths) {
  if (!CONFIG.MAX_MONTH) return true;
  if (!availableMonths || availableMonths.length === 0) return false;

  const maxMonthNumber = MONTH_MAP[CONFIG.MAX_MONTH];
  if (!maxMonthNumber) {
    console.warn(`⚠️ MAX_MONTH "${CONFIG.MAX_MONTH}" no es válido.`);
    return true;
  }
  return availableMonths.some(month => month.number <= maxMonthNumber);
}

module.exports = { parseAvailableMonths, isValidMonthForNotification };
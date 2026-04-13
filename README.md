# 🆔 Cita DNI Watcher

> 🚀 Automatiza el monitoreo de citas para DNI en España. Recibe notificaciones instantáneas en Telegram cuando haya disponibilidad.

## 📖 Índice

- [🎯 Motivación](#-motivación)
- [📱 Compatibilidad](#-compatibilidad)
- [📋 Requisitos](#-requisitos)
- [🚀 Instalación](#-instalación)
- [⚙️ Configuración](#-configuración)
- [🏃 Ejecución](#-ejecución)
- [💡 Ejemplos de uso](#-ejemplos-de-uso)
- [🛠️ Funcionamiento](#-funcionamiento)

## 🎯 Motivación

En España, conseguir una cita para renovar el DNI se ha convertido en una tarea prácticamente imposible. Actualmente, es normal tener que esperar **más de dos meses** para poder solicitar una cita.

El principal problema es que **no existe ningún sistema de notificación** que te avise cuando hay huecos libres disponibles. Esto significa que tienes que estar constantemente vigilando la página, refrescando cada pocos minutos con la esperanza de encontrar una cita disponible.

**Cita DNI Watcher** surge precisamente para resolver este problema: automatiza el monitoreo de la disponibilidad de citas y te notifica automáticamente a través de Telegram **en el momento exacto en que se libera un hueco**, sin que tengas que estar pegado a la pantalla.

## 📱 Compatibilidad

Este proyecto es compatible con sistemas Windows y Unix (Linux, macOS). Las instrucciones y el código están diseñados para funcionar en ambos entornos sin modificaciones adicionales.

## 📋 Requisitos

- 🟢 Node.js (versión 14 o superior)
- 📦 npm

## 🚀 Instalación

1. Clona o descarga este repositorio.
2. Navega al directorio del proyecto:
   ```
   cd cita-dni
   ```
3. Instala las dependencias:
   ```
   npm install
   ```

4. Copia el archivo de ejemplo de configuración:
   ```bash
   cp .env.example .env
   ```

5. Edita el archivo `.env` con tus credenciales de Telegram y preferencias personalizado.

## ⚙️ Configuración

### Archivo de configuración `.env`

Copia el archivo de ejemplo y personalízalo con tus datos:

```bash
cp .env.example .env
```

Luego edita el archivo `.env` con tus credenciales de Telegram y preferencias.

### Contenido del `.env`

El archivo `.env` debe contener las siguientes variables de entorno:

```
TELEGRAM_BOT_TOKEN=tu_token_de_bot_de_telegram
TELEGRAM_CHAT_ID=tu_chat_id_de_telegram
CHECK_INTERVAL_MINUTES=10
CITA_DNI_URL=https://sede.administracionespublicas.gob.es/icpplus/index
MAX_MONTH=mayo
```

### Variables de configuración

- 🔑 **TELEGRAM_BOT_TOKEN**: Token de tu bot de Telegram (obligatorio)
- 🆔 **TELEGRAM_CHAT_ID**: Tu chat ID de Telegram (obligatorio)
- ⏱️ **CHECK_INTERVAL_MINUTES**: Intervalo en minutos entre verificaciones (por defecto: 10)
- 🔗 **CITA_DNI_URL**: URL inicial para el proceso de citas (por defecto: la URL de la sede de Administraciones Públicas)
- 📅 **MAX_MONTH**: Mes máximo aceptable para la cita (ej: `mayo`, `abril`, etc.). Si la página muestra citas para meses posteriores, no se enviará notificación. Si se deja vacío, se notificará de cualquier mes. (por defecto: vacío)

### 🤖 Cómo obtener el TOKEN del bot de Telegram

1. Abre Telegram y busca @BotFather
2. Envía el comando `/newbot`
3. Sigue las instrucciones para crear tu bot
4. Copia el token que te proporciona BotFather

### Cómo obtener el CHAT_ID

1. Abre Telegram y busca @userinfobot
2. Envía cualquier mensaje al bot
3. El bot te responderá con tu información, incluyendo el chat_id

## 🏃 Ejecución

Para ejecutar el script:

```
node watch-cita-dni.js
```

El script se ejecutará en modo headless: false por defecto, lo que significa que verás el navegador abriéndose y navegando automáticamente.

**Nota**: Puedes detener el script en cualquier momento con Ctrl+C. El script cerrará el navegador y enviará una notificación de detención por Telegram antes de salir.

## 💡 Ejemplos de uso

### Ejemplo 1: Notificación solo para citas en mayo o antes

Si estamos en abril y quieres que solo te notifique si aparecen citas en abril o mayo:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
CHECK_INTERVAL_MINUTES=5
MAX_MONTH=mayo
```

Con esta configuración:
- ✅ Si la página muestra "Mayo" → **Notificación enviada**
- ✅ Si la página muestra "Abril" → **Notificación enviada**
- ❌ Si la página muestra "Junio" → **Sin notificación** (es posterior a mayo)
- ❌ Si la página muestra "Junio, Julio" → **Sin notificación** (ambos posteriores a mayo)
- ✅ Si la página muestra "Abril, Junio" → **Notificación enviada** (abril es válido)

### Ejemplo 2: Sin filtro de mes (notificación de cualquier mes)

Si quieres recibir notificación de cualquier mes disponible:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
CHECK_INTERVAL_MINUTES=10
MAX_MONTH=mayo
```

## Funcionamiento

El script:
1. Abre un navegador Chromium
2. Navega a la página de citas para DNI
3. Monitorea cambios en la página
4. Extrae los meses disponibles cuando detecta cambios
5. Filtra según el mes máximo configurado (si está disponible)
6. Toma capturas de pantalla cuando detecta cambios válidos
7. Envía notificaciones por Telegram con actualizaciones


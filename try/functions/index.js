const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const twilio    = require("twilio");

admin.initializeApp();

// ─── Helper: read env with fallback to Firebase config ───────────────────────
function env(key) {
  // 1. Process env (local .env or CI)
  if (process.env[key]) return process.env[key];
  // 2. Firebase Functions config (set via: firebase functions:secrets:set KEY)
  try {
    const cfg = functions.config();
    const lower = key.toLowerCase();
    // Support both TWILIO_SID → cfg.twilio.sid  and  flat cfg[key]
    if (lower.startsWith("twilio_")) {
      const sub = lower.replace("twilio_", "");
      if (cfg.twilio && cfg.twilio[sub]) return cfg.twilio[sub];
    }
    if (cfg[lower]) return cfg[lower];
  } catch (_) { /* no config set yet */ }
  return null;
}

// ─── Firestore trigger: fires on every new alerts/{alertId} document ─────────
exports.alertOnCritical = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {

    const data = snap.data();
    if (!data) return null;

    // Only send for: Critical (riskLevel 2), SOS active, or Fall detected
    const isCritical = data.riskLevel === 2;
    const isSos      = data.sosActive  === true;
    const isFall     = data.fallFlag   === 1;

    if (!isCritical && !isSos && !isFall) {
      console.log(`[skip] alert ${context.params.alertId} — not critical/SOS/fall`);
      return null;
    }

    // ── Build alert message ──────────────────────────────────────────────────
    const condLabel   = data.conditionLabel || data.riskLabel || "CRITICAL";
    const scoreVal    = data.healthScore    != null ? `${data.healthScore}/100` : "N/A";
    const hr          = data.hr             != null ? `${Number(data.hr).toFixed(0)} BPM` : "N/A";
    const spo2        = data.spo2           != null ? `${Number(data.spo2).toFixed(1)}%`  : "N/A";
    const temp        = data.temperature    != null ? `${Number(data.temperature).toFixed(1)}°C` : "N/A";
    const aqi         = data.aqi            != null ? `${data.aqi}` : "N/A";
    const ts          = data.timestamp      || new Date().toISOString();

    const triggerLine = isSos  ? "🆘 SOS BUTTON ACTIVATED"
                      : isFall ? "⚠️  FALL DETECTED"
                      :          "🔴 CRITICAL HEALTH ALERT";

    const messageBody =
`🚨 EDGEGUARD EMERGENCY 🚨
${triggerLine}

Condition : ${condLabel}
Risk Score: ${scoreVal}
Time      : ${ts}

━━ Vitals ━━━━━━━━━━━━━
❤️  Heart Rate : ${hr}
💧 SpO₂       : ${spo2}
🌡️  Temperature: ${temp}
💨 AQI         : ${aqi}

Please check on the wearer immediately.
— EdgeGuard Health System`;

    // ── Twilio credentials ───────────────────────────────────────────────────
    const sid          = env("TWILIO_SID");
    const token        = env("TWILIO_TOKEN");
    const fromWhatsapp = env("TWILIO_FROM") || "whatsapp:+14155238886";
    const toWhatsapp   = env("TWILIO_TO");

    if (!sid || !token || !toWhatsapp) {
      console.error("[Twilio] Missing credentials. Set TWILIO_SID, TWILIO_TOKEN, TWILIO_TO via firebase functions:secrets:set or .env");
      // Still return success so the function doesn't retry infinitely
      return null;
    }

    const client = twilio(sid, token);

    try {
      const msg = await client.messages.create({
        from: fromWhatsapp,
        to:   toWhatsapp,
        body: messageBody,
      });
      console.log(`[Twilio] Message sent. SID: ${msg.sid}`);
      return { success: true, sid: msg.sid };
    } catch (err) {
      console.error("[Twilio] Send failed:", err.message);
      // Don't throw — avoids infinite Cloud Function retries on Twilio errors
      return { success: false, error: err.message };
    }
  });

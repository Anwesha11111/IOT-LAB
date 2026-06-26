const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();

exports.alertOnCritical = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data) {
      console.log("No data found in firestore alert document.");
      return null;
    }

    // Process alerts only if they are Critical (riskLevel === 2) or SOS button active
    if (data.riskLevel !== 2 && !data.sosActive) {
      console.log(`Alert ${context.params.alertId} skipped (RiskLevel: ${data.riskLevel}, SOS: ${data.sosActive}).`);
      return null;
    }

    console.log(`Processing Critical alert ${context.params.alertId}:`, data);

    const sid = process.env.TWILIO_SID || "YOUR_TWILIO_SID";
    const token = process.env.TWILIO_TOKEN || "YOUR_TWILIO_TOKEN";
    const fromWhatsapp = process.env.TWILIO_FROM || "whatsapp:+14155238886";
    const toWhatsapp = process.env.TWILIO_TO || "whatsapp:+917981719866"; // Targeted Caregiver

    const client = twilio(sid, token);

    try {
      const message = await client.messages.create({
        from: fromWhatsapp,
        to: toWhatsapp,
        body: `🚨 EDGEGUARD EMERGENCY ALERT! 🚨

Condition Alert: ${data.riskLabel || "CRITICAL"}
SOS Status: ${data.sosActive ? "ACTIVE" : "INACTIVE"}

Vitals Data:
- Heart Rate: ${data.hr || "N/A"} BPM
- SpO2: ${data.spo2 || "N/A"}%
- Air Quality (AQI): ${data.aqi || "N/A"}

Please perform clinical protocols immediately.`
      });

      console.log("Twilio alert successfully sent, SID:", message.sid);
      return { success: true, messageSid: message.sid };
    } catch (error) {
      console.error("Twilio message delivery failed:", error);
      throw new functions.https.HttpsError("internal", "SMS Notification failed.");
    }
  });

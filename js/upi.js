/* Pithoo 3D — UPI payment rail (deep link + QR + UTR entry).
   Static frontend: cannot verify with the bank. The pay button is disabled
   until a real UPI ID is configured. "Verify" only checks UTR format. */
(function () {
  const cfg = () => PT.config;

  function isConfigured() {
    const id = (cfg().UPI_ID || "").trim();
    return id && !/REPLACE_WITH_YOUR_UPI_ID/i.test(id) && /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(id);
  }

  function buildIntent() {
    const c = cfg();
    const txnRef = "PTHOO" + Date.now().toString(36).toUpperCase();
    const params = new URLSearchParams({
      pa: c.UPI_ID.trim(),
      pn: c.UPI_PAYEE_NAME,
      am: String(c.PRO_PRICE_INR),
      cu: "INR",
      tn: "Pithoo 3D Pro unlock",
      tr: txnRef
    });
    return { intent: "upi://pay?" + params.toString(), txnRef };
  }

  function qrUrl(intent) {
    return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&color=111111&bgcolor=ffffff&data=" +
      encodeURIComponent(intent);
  }

  function validUtr(v) {
    return /^\d{12}$/.test((v || "").trim());
  }

  function activatePro() {
    try { localStorage.setItem("pt_pro", "1"); } catch (e) {}
    try { localStorage.setItem("pt_pro_at", String(Date.now())); } catch (e) {}
  }

  function isPro() {
    try { return localStorage.getItem("pt_pro") === "1"; } catch (e) { return false; }
  }

  PT.upi = { isConfigured, buildIntent, qrUrl, validUtr, activatePro, isPro };
})();

// api/quote.js — receives a wholesale pricing request and forwards it to
// Supabase (submit_quote_request RPC), which stores the lead and emails
// Golden West via the same notification stack used for retail orders.
const SUPABASE_URL = "https://oxbklxjsbljpjzwpizip.supabase.co";
const ANON_KEY = "sb_publishable_2KY1gFQhNtDCask3gOTSkw_aggcMo3L"; // public client key

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (!b.business || !b.email || !b.phone) {
    return res.status(400).json({ error: "Missing business, email, or phone." });
  }
  const str = (v) => (v == null ? "" : String(v).slice(0, 2000));
  const payload = {
    business: str(b.business), name: str(b.name), email: str(b.email),
    phone: str(b.phone), businessType: str(b.businessType), cityState: str(b.cityState),
    zip: str(b.zip), volume: str(b.volume),
    products: [...(Array.isArray(b.products) ? b.products.map(str) : []), str(b.extraProducts)].filter(Boolean).join(", "),
    message: str(b.message), lang: b.lang === "es" ? "es" : "en",
  };
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/submit_quote_request", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
      body: JSON.stringify({ payload }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("quote_request store failed", r.status, t.slice(0, 300));
      return res.status(502).json({ error: "Could not submit your request — please call us or try again." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("quote_request error", e);
    return res.status(502).json({ error: "Could not submit your request — please call us or try again." });
  }
}

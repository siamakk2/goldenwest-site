// api/quote.js — Vercel serverless function (Node 18+, no dependencies)
// Receives a wholesale pricing request, emails Golden West, and optionally
// stores the lead. Everything is optional via env vars so it works on deploy.
//
//   QUOTE_TO           who receives the lead   (default oscar@goldenwestchem.com)
//   QUOTE_CC           optional CC (e.g. Siamak)
//   RESEND_API_KEY     enables email via Resend  (https://resend.com — free tier)
//   RESEND_FROM        verified sender (default onboarding@resend.dev for testing)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   optional lead storage

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  // minimal validation
  if (!b.business || !b.email || !b.phone) {
    return res.status(400).json({ error: "Missing business, email, or phone." });
  }

  const lead = {
    business: str(b.business), name: str(b.name), email: str(b.email),
    phone: str(b.phone), businessType: str(b.businessType), cityState: str(b.cityState),
    zip: str(b.zip), volume: str(b.volume),
    products: Array.isArray(b.products) ? b.products.map(str) : [],
    extraProducts: str(b.extraProducts), message: str(b.message),
    lang: b.lang === "es" ? "es" : "en",
    submittedAt: new Date().toISOString(),
    ua: str(req.headers["user-agent"]).slice(0, 200),
  };

  // fire-and-forget storage + email; never fail the user if one channel is down
  await Promise.allSettled([storeLead(lead), emailLead(lead)]);

  return res.status(200).json({ ok: true });
}

const str = (v) => (v == null ? "" : String(v).slice(0, 2000));
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

async function emailLead(lead) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // email disabled until a key is set
  const to = (process.env.QUOTE_TO || "oscar@goldenwestchem.com").split(",").map((s) => s.trim());
  const from = process.env.RESEND_FROM || "Golden West Site <onboarding@resend.dev>";
  const cc = process.env.QUOTE_CC ? process.env.QUOTE_CC.split(",").map((s) => s.trim()) : undefined;

  const prod = [...lead.products, lead.extraProducts].filter(Boolean).join(", ") || "—";
  const rows = [
    ["Business", lead.business], ["Contact", lead.name], ["Email", lead.email],
    ["Phone", lead.phone], ["Business type", lead.businessType], ["Location", lead.cityState],
    ["Shipping ZIP", lead.zip], ["Monthly volume", lead.volume], ["Products", prod],
    ["Message", lead.message], ["Language", lead.lang], ["Submitted", lead.submittedAt],
  ].map(([k, v]) => `<tr><td style="padding:6px 12px;color:#5C6E7A;font-weight:600">${k}</td><td style="padding:6px 12px">${esc(v || "—")}</td></tr>`).join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#0B2A45;margin:0 0 4px">New wholesale pricing request</h2>
    <p style="color:#5C6E7A;margin:0 0 16px">${esc(lead.business)} — reply within the day to win the account.</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #D7E1E8;border-radius:8px">${rows}</table>
  </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, cc, reply_to: lead.email,
      subject: `Wholesale request — ${lead.business}`,
      html,
    }),
  });
  if (!r.ok) throw new Error("resend " + r.status);
}

async function storeLead(lead) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return; // storage disabled until configured
  const key = `lead:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!r.ok) throw new Error("upstash " + r.status);
}

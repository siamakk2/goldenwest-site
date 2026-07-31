// api/sitemap.js — live sitemap generated from the Supabase catalog.
// Served at /sitemap.xml via a rewrite in vercel.json, so it never goes
// stale when products are added, renamed, or deactivated in /admin.
const SUPABASE_URL = "https://oxbklxjsbljpjzwpizip.supabase.co";
const ANON_KEY = "sb_publishable_2KY1gFQhNtDCask3gOTSkw_aggcMo3L"; // public read-only key
const HOST = "https://www.goldenwestchem.com";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return null; } };

export default async function handler(req, res) {
  let products = [];
  let newest = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(
      SUPABASE_URL + "/rest/v1/products?select=slug,updated_at&active=eq.true&order=sort_order.asc&limit=1000",
      { headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY }, signal: ctl.signal }
    );
    clearTimeout(timer);
    if (r.ok) {
      products = await r.json();
      newest = products.reduce((m, p) => (p.updated_at > (m || "") ? p.updated_at : m), null);
    }
  } catch { /* fall through — static pages still ship */ }

  const staticPages = [
    { loc: HOST + "/", changefreq: "weekly", priority: "1.0", lastmod: newest },
    { loc: HOST + "/shop", changefreq: "daily", priority: "0.9", lastmod: newest },
    { loc: HOST + "/wholesale", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/contact", changefreq: "yearly", priority: "0.6", lastmod: null },
    { loc: HOST + "/wholesale-car-wash-soap", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/wholesale-detailing-supplies", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/car-wash-chemicals", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/car-wash-supplies-los-angeles", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/truck-fleet-wash-soap", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/touchless-tunnel-car-wash-chemicals", changefreq: "monthly", priority: "0.8", lastmod: null },
    { loc: HOST + "/es/car-wash-chemicals", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/es/car-wash-supplies-los-angeles", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/es/truck-fleet-wash-soap", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/es/touchless-tunnel-car-wash-chemicals", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/es/wholesale-car-wash-soap", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/es/wholesale-detailing-supplies", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/car-wash-chemicals", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/car-wash-supplies-los-angeles", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/truck-fleet-wash-soap", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/touchless-tunnel-car-wash-chemicals", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/wholesale-car-wash-soap", changefreq: "monthly", priority: "0.7", lastmod: null },
    { loc: HOST + "/ko/wholesale-detailing-supplies", changefreq: "monthly", priority: "0.7", lastmod: null },
  ];

  const urls = staticPages
    .concat(
      products
        .filter((p) => p.slug)
        .map((p) => ({
          loc: HOST + "/shop?p=" + encodeURIComponent(p.slug),
          changefreq: "monthly",
          priority: "0.6",
          lastmod: p.updated_at,
        }))
    )
    .map((u) => {
      const lm = u.lastmod ? day(u.lastmod) : null;
      return (
        "  <url><loc>" + esc(u.loc) + "</loc>" +
        (lm ? "<lastmod>" + lm + "</lastmod>" : "") +
        "<changefreq>" + u.changefreq + "</changefreq>" +
        "<priority>" + u.priority + "</priority></url>"
      );
    })
    .join("\n");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    "\n</urlset>\n";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(xml);
}

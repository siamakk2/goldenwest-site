# Golden West Corporation — Wholesale Site

Fast, static wholesale **catalog + lead-capture** site. No cart, no checkout.
Buyers browse products, add them to a **quote list**, and submit a pricing request.
Every submission emails Golden West a qualified lead (business, shipping ZIP,
products, volume). Bilingual **EN/ES**. Built to deploy on **Vercel** from **GitHub**.

```
index.html            → the whole page (SEO/LLMO ready, JSON-LD LocalBusiness)
assets/data.js        → ALL products + categories + EN/ES text  ← edit this to change catalog
assets/styles.css     → design system
assets/app.js         → catalog render, language toggle, quote builder, form
api/quote.js          → serverless lead capture (email + optional storage)
robots.txt / llms.txt / sitemap.xml → SEO + AI-search
vercel.json           → caching + security headers
```

---

## Deploy (GitHub → Vercel)

1. **Create the repo.** New GitHub repo (e.g. `siamakk2/goldenwest-site`), upload
   these files (or push them). Main branch.
2. **Import to Vercel.** Vercel → *Add New → Project → Import* the repo.
   Framework preset: **Other** (it's static + a serverless function). No build command needed.
3. **Deploy.** Vercel serves `index.html` and runs `api/quote.js` automatically.
4. **Add the domain.** Point `goldenwestchem.com` at the Vercel project when ready.

> Reminder (your rule): update the existing Vercel project on future changes —
> don't spin up new ones.

---

## Turn on lead capture (2 min)

The form works immediately, but leads only go somewhere once you set env vars in
**Vercel → Project → Settings → Environment Variables**:

**Email the lead (recommended) — via [Resend](https://resend.com) free tier:**

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | your Resend API key |
| `RESEND_FROM` | `Golden West <quotes@goldenwestchem.com>` (verify the domain in Resend) |
| `QUOTE_TO` | `oscar@goldenwestchem.com` |
| `QUOTE_CC` | *(optional)* your address, to shadow every lead |

**Also store leads (optional) — via Upstash Redis (same as Orchamind):**

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash |

Redeploy after adding vars. Both channels are optional and independent — email
without storage is fine, and vice versa.

---

## Edit the catalog

Open **`assets/data.js`** and copy a product block:

```js
{
  id: "unique-slug", cat: "chemical", brand: "Golden West",
  en: "Product Name", es: "Nombre del Producto",
  dEn: "English description.", dEs: "Descripción en español.",
  sizes: ["5 gal", "55 gal drum"], sds: true, tag: "Best seller" // tag optional
}
```

`cat` must be one of the category ids at the top of the file
(`chemical`, `tunnel`, `finishing`, `waxes`, `brands`, `supplies`).
Save → commit → Vercel redeploys. No build step.

---

## Add real product photos (later)

Right now cards are clean and photo-free (fast, no broken images). To add photos,
drop a `photo` field on a product (`photo: "/assets/img/blue-soap.webp"`),
put the file in `assets/img/`, and add an `<img>` in `cardHTML()` in `app.js`.
Ask me and I'll wire it up.

---

## Notes

- **Prices are intentionally hidden.** Wholesale = quote request. That's the lead engine.
- **OG image:** add `assets/og-image.png` (1200×630) for nice link previews.
- **Bilingual:** the EN/ES toggle covers the whole UI *and* product copy.
- **Performance/LLMO:** static HTML, deferred nothing-heavy, JSON-LD, llms.txt,
  AI-crawler allowlist. Should score in the 90s on mobile PageSpeed out of the box.

---

## Admin panel + live database (Supabase)

Staff can add/edit products with photos at **`/admin`** — no code, no GitHub.
Products live in Supabase; the storefront reads them live and falls back to the
built-in catalog (`assets/data.js`) if the database is ever unreachable.

**Files:**
- `db/schema.sql` — tables, row-level security, and the image storage bucket. Run once.
- `db/seed.sql` — loads the 20 starter products + categories.
- `admin.html` — the admin panel (Supabase Auth login + product CRUD + image upload).
- `assets/config.js` — Supabase URL + anon key for the **public** site (read-only).

**Setup (Claude does this automatically once Supabase is connected):**
1. Create a Supabase project.
2. Run `db/schema.sql` then `db/seed.sql` in the SQL editor.
3. Paste the project's **URL** and **anon key** into:
   - `assets/config.js` (public site), and
   - the `GW_CONFIG` block at the top of `admin.html`.
4. Create a staff login: Supabase → Authentication → Users → Add user (email + password).
5. Redeploy. Staff go to `/admin`, sign in, and manage products.

**Security notes:**
- The anon key is safe to ship publicly — row-level security only allows *reading
  active products*. All writes require a signed-in staff account.
- `admin.html` is `noindex` and gated by login, but it's still a public URL —
  that's fine because nothing works without a valid Supabase session.

**Importing their existing photos:** once the project is live, Claude pulls the
real product images from the current WordPress site, re-hosts them in Supabase
Storage (so they don't break if the old site goes away), and links each to its
product.

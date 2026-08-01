/* ===== Golden West — front-end app ===== */
(function () {
  const D = window.GW;

  /* ================= AI site search ================= */
  function initSearch() {
    const right = document.querySelector(".hdr-right");
    if (!right || document.querySelector(".srch-btn")) return;
    const t = (k, fb) => (window.GW && GW.i18n && GW.i18n[lang] && GW.i18n[lang][k]) || fb;

    const btn = document.createElement("button");
    btn.className = "srch-btn"; btn.setAttribute("aria-label", "Search");
    btn.innerHTML = '<span>&#128269;</span><span class="srch-btn-t">' + t("search_btn", "Search") + "</span>";
    right.insertBefore(btn, right.firstChild);

    const ov = document.createElement("div");
    ov.className = "srch-ov";
    ov.innerHTML = `<div class="srch-box" role="dialog" aria-modal="true">
      <div class="srch-bar"><span>&#128269;</span><input type="search" autocomplete="off" /><button class="srch-x" aria-label="Close">&times;</button></div>
      <div class="srch-ai" hidden><div class="srch-ai-a"></div><div class="srch-ai-l"></div><div class="srch-ai-p"></div></div>
      <div class="srch-res"></div>
      <div class="srch-hint"></div>
    </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector("input"), res = ov.querySelector(".srch-res"),
      aiBox = ov.querySelector(".srch-ai"), aiA = ov.querySelector(".srch-ai-a"),
      aiL = ov.querySelector(".srch-ai-l"), aiP = ov.querySelector(".srch-ai-p"),
      hint = ov.querySelector(".srch-hint");

    const PAGES = {
      en: [["Car Wash Chemicals","/car-wash-chemicals"],["Bulk Car Wash Soap","/wholesale-car-wash-soap"],["Tunnel & Touchless Chemicals","/touchless-tunnel-car-wash-chemicals"],["Truck & Fleet Wash","/truck-fleet-wash-soap"],["Los Angeles Supplies & Delivery","/car-wash-supplies-los-angeles"],["Detailing Supplies","/wholesale-detailing-supplies"],["Shop — all 295 products","/shop"],["Wholesale Accounts & Pricing","/wholesale"],["Contact / Hours / Address","/contact"],["Manufacturing","/#manufacturing"],["FAQ","/#faq"]],
      es: [["Químicos para Autolavado","/es/car-wash-chemicals"],["Jabón al Mayoreo","/es/wholesale-car-wash-soap"],["Túnel y Sin Contacto","/es/touchless-tunnel-car-wash-chemicals"],["Camiones y Flotillas","/es/truck-fleet-wash-soap"],["Insumos en Los Ángeles","/es/car-wash-supplies-los-angeles"],["Insumos de Detallado","/es/wholesale-detailing-supplies"],["Tienda — 295 productos","/shop"],["Mayoreo y Precios","/wholesale"],["Contacto / Horario","/contact"]],
      ko: [["세차 약품","/ko/car-wash-chemicals"],["대량 세차 세제","/ko/wholesale-car-wash-soap"],["터널·터치리스","/ko/touchless-tunnel-car-wash-chemicals"],["트럭·플릿 세차","/ko/truck-fleet-wash-soap"],["LA 세차 용품·배송","/ko/car-wash-supplies-los-angeles"],["디테일링 용품","/ko/wholesale-detailing-supplies"],["쇼핑 — 295개 제품","/shop"],["도매 계정·단가","/wholesale"],["문의 / 영업시간","/contact"]],
    };

    const norm = (s) => String(s || "").toLowerCase();
    function local(q) {
      const n = norm(q), toks = n.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2);
      if (!toks.length) return { prods: [], pages: [] };
      const score = (hay) => toks.reduce((a, tk) => a + (hay.indexOf(tk) >= 0 ? 1 : 0), 0);
      const prods = (D.products || [])
        .map((p) => ({ p, s: score(norm([p.en, p.es, p.ko, p.dEn, p.dEs, p.brand].join(" "))) }))
        .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.p);
      const pages = (PAGES[lang] || PAGES.en).filter(([lbl]) => score(norm(lbl)) > 0).slice(0, 4);
      return { prods, pages };
    }

    function pname(p) { return lang === "es" ? (p.es || p.en) : lang === "ko" ? (p.ko || p.en) : p.en; }
    function render(q) {
      const { prods, pages } = local(q);
      let h = "";
      if (pages.length) h += `<div class="srch-h">${t("search_pages","Pages")}</div>` +
        pages.map(([l, u]) => `<a class="srch-row" href="${u}"><span class="srch-ico">&#9656;</span>${l}</a>`).join("");
      if (prods.length) h += `<div class="srch-h">${t("search_products","Products")}</div>` +
        prods.map((p) => `<a class="srch-row" href="/shop?p=${encodeURIComponent(p.id)}">` +
          (p.image ? `<img src="${p.image}" alt="" loading="lazy" />` : `<span class="srch-ico">&#9642;</span>`) +
          `<span>${pname(p)}</span></a>`).join("");
      res.innerHTML = h;
      hint.textContent = q.trim().length >= 2 ? t("search_ask", "Press Enter to ask AI \u2192 answers only from this site") : "";
    }

    let aiTimer = null, aiSeq = 0;
    async function askAI(q) {
      const seq = ++aiSeq;
      aiBox.hidden = false; aiA.textContent = t("search_thinking", "Thinking\u2026"); aiL.innerHTML = ""; aiP.innerHTML = "";
      try {
        const cfg = window.GW_CONFIG || {};
        const r = await fetch("https://oxbklxjsbljpjzwpizip.supabase.co/functions/v1/sitesearch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ k: "gw-search-2026", q, lang }),
        });
        const d = await r.json();
        if (seq !== aiSeq) return;
        if (!d.ok) { aiA.textContent = t("search_err", "Search is unavailable right now."); return; }
        aiA.textContent = d.answer || "";
        aiL.innerHTML = (d.links || []).map((l) => `<a href="${l.u}">${l.t}</a>`).join("");
        aiP.innerHTML = (d.products || []).map((p) => `<a class="srch-row" href="/shop?p=${encodeURIComponent(p.slug)}">` +
          (p.image ? `<img src="${p.image}" alt="" loading="lazy" />` : "") + `<span>${p.name}</span></a>`).join("");
      } catch (_e) { if (seq === aiSeq) aiA.textContent = t("search_err", "Search is unavailable right now."); }
    }

    function open() { ov.classList.add("on"); input.value = ""; res.innerHTML = ""; aiBox.hidden = true; hint.textContent = ""; input.setAttribute("placeholder", t("search_ph", "Search products, guides, questions\u2026")); setTimeout(() => input.focus(), 30); }
    function close() { ov.classList.remove("on"); }
    btn.addEventListener("click", open);
    ov.querySelector(".srch-x").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    input.addEventListener("input", () => {
      render(input.value);
      clearTimeout(aiTimer);
      const q = input.value.trim();
      if (q.length >= 8) aiTimer = setTimeout(() => askAI(q), 1200);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && input.value.trim().length >= 2) { clearTimeout(aiTimer); askAI(input.value.trim()); } });
  }

  let lang = localStorage.getItem("gw_lang") || "en";

  /* ---------- optional: load live products from Supabase ----------
     If config.js has credentials AND the Supabase library is present,
     replace the built-in catalog with the live one. Any failure falls
     back silently to the bundled data in data.js. */
  async function loadLive() {
    const cfg = window.GW_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) return false;
    try {
      const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const [cats, prods] = await Promise.all([
        sb.from("categories").select("*").order("sort"),
        sb.from("products").select("*").eq("active", true).order("sort_order").order("name_en"),
      ]);
      if (cats.error || prods.error || !prods.data || !prods.data.length) return false;
      D.categories = cats.data.map((c) => ({ id: c.id, en: c.name_en, es: c.name_es, ko: c.name_ko }));
      D.products = prods.data.map((p) => ({
        id: p.slug, cat: p.category_id, brand: p.brand,
        en: p.name_en, es: p.name_es || p.name_en, ko: p.name_ko || p.name_en,
        dEn: p.desc_en || "", dEs: p.desc_es || p.desc_en || "", dKo: p.desc_ko || p.desc_en || "",
        sizes: p.sizes || [], sds: p.sds, tag: p.tag || null, image: p.image_url || null,
      }));
      return true;
    } catch (e) { return false; }
  }
  let filter = "all";
  let picked = JSON.parse(localStorage.getItem("gw_quote") || "[]"); // array of product ids

  /* pick a localised field, falling back to English */
  const L  = (o, base) => (o && (o[base + (lang === "en" ? "" : "_" + lang)] ?? o[base])) || "";
  const nameOf = (o) => (o && (lang === "es" ? o.es : lang === "ko" ? o.ko : o.en)) || (o && o.en) || "";
  const descOf = (o) => (o && (lang === "es" ? o.dEs : lang === "ko" ? o.dKo : o.dEn)) || (o && o.dEn) || "";
  const t = (k) => (D.i18n[lang] && D.i18n[lang][k]) ?? D.i18n.en[k] ?? k;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const prod = (id) => D.products.find((p) => p.id === id);

  /* ---------- i18n: swap all [data-i18n] text ---------- */
  function applyI18n() {
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.documentElement.lang = lang;
    $$(".lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
    buildForm();      // selects depend on language
    renderFilters();
    renderProducts();
    renderPicked();
  }

  /* ---------- filters ---------- */
  function renderFilters() {
    const box = $("#filters");
    if (!box) return;
    const cats = [{ id: "all", en: t("cat_all"), es: t("cat_all"), ko: t("cat_all") }, ...D.categories];
    box.innerHTML = cats
      .map((c) => `<button data-cat="${c.id}" class="${filter === c.id ? "on" : ""}">${nameOf(c)}</button>`)
      .join("");
    $$("#filters button").forEach((b) =>
      b.addEventListener("click", () => { filter = b.dataset.cat; renderFilters(); renderProducts(); })
    );
  }

  /* ---------- product grid ---------- */
  function renderProducts() {
    const grid = $("#grid");
    if (!grid) return;
    const list = D.products.filter((p) => filter === "all" || p.cat === filter);
    grid.innerHTML = list.map(cardHTML).join("");
    $$(".add", grid).forEach((btn) =>
      btn.addEventListener("click", () => togglePick(btn.dataset.id))
    );
    observeReveals();
  }

  function cardHTML(p) {
    const name = nameOf(p);
    const desc = descOf(p);
    const on = picked.includes(p.id);
    const flag = p.tag ? `<span class="flag">${p.tag}</span>` : "";
    const sizes = p.sizes.map((s) => `<span class="chip">${s}</span>`).join("");
    const sds = p.sds ? `<div class="sds">▣ ${t("spec_sds")}</div>` : "";
    const img = p.image ? `<div class="cardimg"><img src="${p.image}" alt="${name}" loading="lazy"></div>` : "";
    return `<article class="card reveal">
      ${img}
      <div class="top"><span class="brandtag">${p.brand}</span>${flag}</div>
      <h3>${name}</h3>
      <p>${desc}</p>
      <div class="sizes" aria-label="${t("spec_sizes")}">${sizes}</div>
      ${sds}
      <button class="btn ${on ? "btn-water add added" : "btn-outline add"}" data-id="${p.id}">
        ${on ? t("card_added") : t("card_cta")}
      </button>
    </article>`;
  }

  /* ---------- quote builder ---------- */
  function togglePick(id) {
    picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    localStorage.setItem("gw_quote", JSON.stringify(picked));
    renderProducts();
    renderPicked();
    flashTray();
  }

  function renderPicked() {
    // floating button
    const tb = $("#trayBtn");
    if (tb) {
      tb.classList.toggle("show", picked.length > 0);
      const tc = $("#trayCount"); if (tc) tc.textContent = picked.length;
    }
    // pills in the form
    const box = $("#pickedList");
    if (!box) return;
    if (!picked.length) {
      box.innerHTML = `<span class="hint">${t("form_products_hint")}</span>`;
    } else {
      box.innerHTML = picked
        .map((id) => {
          const p = prod(id); const n = nameOf(p);
          return `<span class="pill">${n}<button data-id="${id}" aria-label="remove">✕</button></span>`;
        })
        .join("");
      $$("#pickedList .pill button").forEach((b) =>
        b.addEventListener("click", () => togglePick(b.dataset.id))
      );
    }
  }

  function flashTray() {
    const tb = $("#trayBtn");
    if (!tb) return;
    tb.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 240 });
  }

  /* ---------- form ---------- */
  function buildForm() {
    const typeSel = $("#f_type"), volSel = $("#f_volume");
    if (typeSel) typeSel.innerHTML = `<option value="">—</option>` +
      t("form_type_opts").map((o) => `<option>${o}</option>`).join("");
    if (volSel) volSel.innerHTML = `<option value="">—</option>` +
      t("form_volume_opts").map((o) => `<option>${o}</option>`).join("");
  }

  async function submitForm(e) {
    e.preventDefault();
    const f = e.target;
    const msg = $("#formMsg");
    const btn = $("#submitBtn");
    msg.className = "form-msg"; msg.style.display = "none";

    const productNames = picked.map((id) => { const p = prod(id); return nameOf(p); });
    const payload = {
      business: f.business.value.trim(),
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      businessType: f.type.value,
      cityState: f.city.value.trim(),
      zip: f.zip.value.trim(),
      volume: f.volume.value,
      products: productNames,
      extraProducts: f.products.value.trim(),
      message: f.message.value.trim(),
      lang, submittedAt: new Date().toISOString(),
    };

    btn.disabled = true; const orig = btn.textContent; btn.textContent = t("form_sending");
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("bad status " + r.status);
      msg.classList.add("ok"); msg.innerHTML = `<strong>${t("form_ok_t")}</strong> ${t("form_ok_d")}`;
      f.reset(); picked = []; localStorage.removeItem("gw_quote"); renderProducts(); renderPicked();
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      msg.classList.add("err"); msg.textContent = t("form_err");
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  /* ---------- misc UI ---------- */
  function observeReveals() {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  }

  function initChrome() {
    // header shadow
    const hdr = $(".hdr");
    if (hdr) addEventListener("scroll", () => hdr.classList.toggle("scrolled", scrollY > 8), { passive: true });
    // lang toggle
    $$(".lang button").forEach((b) => b.addEventListener("click", () => {
      lang = b.dataset.lang; localStorage.setItem("gw_lang", lang); applyI18n();
    }));
    // mobile nav
    const burger = $("#burger"), nav = $("#nav");
    if (burger && nav) {
      burger.addEventListener("click", () => nav.classList.toggle("open"));
      $$("#nav a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
    }
    // tray button → form on this page, else the wholesale page
    const tray = $("#trayBtn");
    if (tray) tray.addEventListener("click", () => {
      const q = $("#quote"); if (q) q.scrollIntoView({ behavior: "smooth" }); else location.href = "/wholesale#quote";
    });
    // form
    const qf = $("#quoteForm");
    if (qf) qf.addEventListener("submit", submitForm);
  }

  async function injectProductSchema() {
    /* Emits an ItemList of Products WITH real retail prices pulled live from
       Supabase. Google flags any Offer without a price as a critical error,
       so products that have no published retail price are simply left out
       of the structured data rather than making an empty claim. */
    try {
      const cfg = window.GW_CONFIG || {};
      const prices = {}; // slug -> [{cents, in_stock}]
      const upcs = {}; // slug -> gtin
      if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
        const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        const [base, sizes] = await Promise.all([
          sb.from("product_retail").select("retail_cents, in_stock, products(slug,upc)").not("retail_cents", "is", null),
          sb.from("size_prices").select("retail_cents, in_stock, products(slug,upc)").not("retail_cents", "is", null),
        ]);
        [...(base.data || []), ...(sizes.data || [])].forEach((r) => {
          const slug = r.products && r.products.slug;
          if (!slug || !r.retail_cents) return;
          (prices[slug] = prices[slug] || []).push({ cents: r.retail_cents, in_stock: r.in_stock !== false });
          if (r.products.upc) upcs[slug] = r.products.upc;
        });
      }
      const usd = (c) => (Number(c) / 100).toFixed(2);
      const items = [];
      D.products.forEach((p) => {
        const list = prices[p.id];
        if (!list || !list.length) return;
        if (!p.image) return; // Merchant listings require an image — omit until a photo exists
        const url = "https://goldenwestchem.com/shop?p=" + encodeURIComponent(p.id);
        const cents = list.map((x) => x.cents).sort((a, b) => a - b);
        const availability = "https://schema.org/" + (list.some((x) => x.in_stock) ? "InStock" : "OutOfStock");
        const seller = { "@type": "Organization", name: "Golden West Chemical" };
        const shippingDetails = {
          "@type": "OfferShippingDetails",
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 2, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
          },
        };
        const hasMerchantReturnPolicy = {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "US",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 30,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
        };
        const offers =
          cents.length > 1
            ? { "@type": "Offer", price: usd(cents[0]), priceCurrency: "USD", availability, url, seller, shippingDetails, hasMerchantReturnPolicy, description: "From " + usd(cents[0]) + " — multiple container sizes available" }
            : { "@type": "Offer", price: usd(cents[0]), priceCurrency: "USD", availability, url, seller, shippingDetails, hasMerchantReturnPolicy };
        items.push({
          "@type": "Product",
          name: p.en,
          description: p.dEn,
          url,
          brand: { "@type": "Brand", name: p.brand },
          ...(upcs[p.id] ? { gtin: upcs[p.id] } : {}),
          category: (D.categories.find((c) => c.id === p.cat) || {}).en || "Car wash supplies",
          ...(p.image ? { image: p.image } : {}),
          offers,
        });
      });
      if (!items.length) return;
      const ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Golden West car wash products",
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, item: it })),
      };
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.textContent = JSON.stringify(ld);
      document.head.appendChild(el);
    } catch (e) {}
  }

  function initLightbox() {
    let lb = document.querySelector(".lbox");
    if (!lb) {
      lb = document.createElement("div"); lb.className = "lbox";
      lb.innerHTML = `<button class="x" aria-label="Close">\u00d7</button><figure><img alt=""><figcaption></figcaption></figure>`;
      document.body.appendChild(lb);
      const close = () => lb.classList.remove("open");
      lb.addEventListener("click", (e) => { if (e.target === lb || (e.target.closest && e.target.closest(".x"))) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    document.addEventListener("click", (e) => {
      const img = e.target.closest && e.target.closest(".card .cardimg img");
      if (!img) return;
      const card = img.closest(".card");
      const h3 = card && card.querySelector("h3");
      lb.querySelector("img").src = img.currentSrc || img.src;
      lb.querySelector("figcaption").textContent = h3 ? h3.textContent : "";
      lb.classList.add("open");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initChrome();
    initLightbox();
    initSearch();
    await loadLive();      // swaps in live catalog if configured; silent fallback otherwise
    applyI18n();
    injectProductSchema();
    observeReveals();
  });
})();

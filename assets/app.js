/* ===== Golden West — front-end app ===== */
(function () {
  const D = window.GW;
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
      D.categories = cats.data.map((c) => ({ id: c.id, en: c.name_en, es: c.name_es }));
      D.products = prods.data.map((p) => ({
        id: p.slug, cat: p.category_id, brand: p.brand,
        en: p.name_en, es: p.name_es || p.name_en,
        dEn: p.desc_en || "", dEs: p.desc_es || p.desc_en || "",
        sizes: p.sizes || [], sds: p.sds, tag: p.tag || null, image: p.image_url || null,
      }));
      return true;
    } catch (e) { return false; }
  }
  let filter = "all";
  let picked = JSON.parse(localStorage.getItem("gw_quote") || "[]"); // array of product ids

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
    const cats = [{ id: "all", en: t("cat_all"), es: t("cat_all") }, ...D.categories];
    box.innerHTML = cats
      .map((c) => `<button data-cat="${c.id}" class="${filter === c.id ? "on" : ""}">${lang === "es" ? c.es : c.en}</button>`)
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
    const name = lang === "es" ? p.es : p.en;
    const desc = lang === "es" ? p.dEs : p.dEn;
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
          const p = prod(id); const n = lang === "es" ? p.es : p.en;
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

    const productNames = picked.map((id) => { const p = prod(id); return lang === "es" ? p.es : p.en; });
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

  function injectProductSchema() {
    try {
      const items = D.products.map((p, i) => ({
        "@type": "Product",
        position: i + 1,
        name: p.en,
        description: p.dEn,
        brand: { "@type": "Brand", name: p.brand },
        category: (D.categories.find((c) => c.id === p.cat) || {}).en || "Car wash supplies",
        ...(p.image ? { image: p.image } : {}),
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          businessFunction: "http://purl.org/goodrelations/v1#Sell",
          priceSpecification: { "@type": "PriceSpecification", valueAddedTaxIncluded: false },
          seller: { "@type": "Organization", name: "Golden West Corporation" },
        },
      }));
      const ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Golden West wholesale car wash products",
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
    await loadLive();      // swaps in live catalog if configured; silent fallback otherwise
    applyI18n();
    injectProductSchema();
    observeReveals();
  });
})();

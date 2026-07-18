/* ===== Golden West — wholesale storefront layer =====
   Sits on top of app.js. Handles: wholesale account signup/login, owner
   approval gating, live pricing for approved buyers, cart, and checkout
   (invoice path live; card path activates when Stripe is connected).
   Public visitors are unaffected — they see the catalog and "request access". */
(function () {
  const cfg = window.GW_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const REQUEST_FN = cfg.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/wholesale-request";

  let session = null;      // supabase auth session
  let account = null;      // wholesale_accounts row for this user
  let priceMap = {};       // slug -> { product_id, price_cents, unit, min_order_qty, in_stock, name, sku }
  let cart = {};           // slug -> qty
  try { cart = JSON.parse(localStorage.getItem("gw_cart") || "{}"); } catch (e) { cart = {}; }

  const money = (c) => "$" + (Number(c || 0) / 100).toFixed(2);
  const approved = () => account && account.status === "approved";
  const saveCart = () => localStorage.setItem("gw_cart", JSON.stringify(cart));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  /* ---------- one-time styles for the wholesale UI ---------- */
  function injectStyles() {
    const css = `
    .ws-acct{display:flex;align-items:center;gap:8px}
    .ws-btn{font-family:var(--font-d);font-weight:600;font-size:.9rem;border-radius:9px;padding:.5em .85em;cursor:pointer;border:1.5px solid transparent;white-space:nowrap}
    .ws-btn.ghost{background:transparent;border-color:rgba(255,255,255,.35);color:#fff}
    .ws-btn.ghost:hover{border-color:#fff}
    .ws-btn.solid{background:var(--amber);color:var(--navy)}
    .ws-cartbtn{position:relative}
    .ws-cartbtn .n{position:absolute;top:-7px;right:-7px;background:var(--water);color:#fff;font-family:var(--font-m);font-size:.66rem;min-width:18px;height:18px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
    /* card pricing */
    .card .ws{margin-top:auto;border-top:1px dashed var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px}
    .card .ws .price{font-family:var(--font-d);font-size:1.35rem;color:var(--navy);font-weight:700;line-height:1}
    .card .ws .price small{font-family:var(--font-m);font-size:.6rem;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;display:block;margin-top:2px}
    .card .ws .oos{font-family:var(--font-m);font-size:.72rem;color:#a12626;text-transform:uppercase;letter-spacing:.08em}
    .ws-add-row{display:flex;gap:8px;align-items:center}
    .ws-qty{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:9px;overflow:hidden}
    .ws-qty button{background:var(--paper);border:0;width:30px;height:34px;cursor:pointer;font-size:1.1rem;color:var(--navy);line-height:1}
    .ws-qty input{width:40px;height:34px;border:0;text-align:center;font-family:var(--font-m);font-size:.9rem;color:var(--ink)}
    .card .ws .btn{width:100%;justify-content:center}
    body.ws-approved .card .add{display:none}
    /* drawer */
    .ws-drawer{position:fixed;inset:0;z-index:120;display:none}
    .ws-drawer.open{display:block}
    .ws-drawer .veil{position:absolute;inset:0;background:rgba(11,42,69,.5)}
    .ws-panel{position:absolute;top:0;right:0;bottom:0;width:min(430px,94vw);background:#fff;box-shadow:-12px 0 40px -18px rgba(0,0,0,.5);display:flex;flex-direction:column}
    .ws-panel header{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
    .ws-panel header h3{font-family:var(--font-d);color:var(--navy);font-size:1.3rem}
    .ws-panel .x{background:none;border:0;font-size:1.5rem;cursor:pointer;color:var(--muted);line-height:1}
    .ws-lines{flex:1;overflow:auto;padding:12px 20px}
    .ws-line{display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .ws-line .nm{flex:1;font-size:.92rem;color:var(--navy);font-weight:600}
    .ws-line .nm small{display:block;color:var(--muted);font-weight:400;font-family:var(--font-m);font-size:.72rem}
    .ws-line .lp{font-family:var(--font-d);color:var(--navy);font-weight:700;white-space:nowrap}
    .ws-line .rm{background:none;border:0;color:#a12626;cursor:pointer;font-size:1rem}
    .ws-foot{border-top:1px solid var(--line);padding:18px 20px;display:flex;flex-direction:column;gap:12px}
    .ws-foot .sum{display:flex;justify-content:space-between;font-family:var(--font-d);font-size:1.2rem;color:var(--navy);font-weight:700}
    .ws-foot .note{font-size:.8rem;color:var(--muted)}
    .ws-empty{color:var(--muted);text-align:center;padding:40px 0}
    /* modal */
    .ws-modal{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;padding:18px}
    .ws-modal.open{display:flex}
    .ws-modal .veil{position:absolute;inset:0;background:rgba(11,42,69,.55)}
    .ws-card{position:relative;background:#fff;border-radius:16px;box-shadow:var(--shadow);width:min(460px,96vw);max-height:92vh;overflow:auto;padding:26px}
    .ws-card h3{font-family:var(--font-d);color:var(--navy);font-size:1.5rem;margin-bottom:6px}
    .ws-card .sub{color:var(--muted);margin-bottom:16px;font-size:.95rem}
    .ws-card .x{position:absolute;top:14px;right:16px;background:none;border:0;font-size:1.5rem;cursor:pointer;color:var(--muted)}
    .ws-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
    .ws-field label{font-family:var(--font-d);font-weight:600;font-size:.9rem;color:var(--navy)}
    .ws-field input,.ws-field select{border:1.5px solid var(--line);border-radius:9px;padding:.66em .8em;font-family:var(--font-b);font-size:1rem}
    .ws-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .ws-msg{border-radius:9px;padding:11px 13px;font-size:.9rem;margin-bottom:12px;display:none}
    .ws-msg.ok{display:block;background:#e8f5ec;border:1px solid #b7dfc3;color:#1c6b39}
    .ws-msg.err{display:block;background:#fdecec;border:1px solid #f3c3c3;color:#a12626}
    .ws-card .swap{margin-top:10px;font-size:.9rem;color:var(--muted)}
    .ws-card .swap a{color:var(--water-dk);cursor:pointer;font-weight:600}
    .ws-pending{background:#fff7e6;border:1px solid #f0d69a;color:#8a6114;border-radius:9px;padding:11px 13px;font-size:.9rem;margin:10px 0}
    `;
    document.head.appendChild(el("style", null, css));
  }

  /* ---------- header controls ---------- */
  function renderHeader() {
    const right = document.querySelector(".hdr-right");
    if (!right) return;
    let box = document.getElementById("wsAcct");
    if (!box) { box = el("div", "ws-acct"); box.id = "wsAcct"; right.insertBefore(box, right.querySelector(".burger")); }
    if (!session) {
      box.innerHTML = `<button class="ws-btn ghost" id="wsLogin">Wholesale login</button>`;
      box.querySelector("#wsLogin").onclick = () => openModal("login");
    } else if (approved()) {
      const n = cartCount();
      box.innerHTML = `<button class="ws-btn ghost" id="wsAcctBtn">${esc(account.business_name)}</button>
        <button class="ws-btn solid ws-cartbtn" id="wsCartBtn">Order${n ? ` <span class="n">${n}</span>` : ""}</button>`;
      box.querySelector("#wsAcctBtn").onclick = () => openModal("account");
      box.querySelector("#wsCartBtn").onclick = openDrawer;
    } else {
      box.innerHTML = `<button class="ws-btn ghost" id="wsAcctBtn">Account · pending</button>`;
      box.querySelector("#wsAcctBtn").onclick = () => openModal("account");
    }
  }

  /* ---------- pricing on cards ---------- */
  function augmentCards() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    document.body.classList.toggle("ws-approved", !!approved());
    if (!approved()) { grid.querySelectorAll(".card .ws").forEach((n) => n.remove()); return; }
    grid.querySelectorAll(".card").forEach((cardEl) => {
      const addBtn = cardEl.querySelector(".add");
      const slug = addBtn && addBtn.dataset.id;
      if (!slug) return;
      let ws = cardEl.querySelector(".ws");
      const p = priceMap[slug];
      if (!p) { if (ws) ws.remove(); return; }
      if (!ws) { ws = el("div", "ws"); cardEl.appendChild(ws); }
      const qty = cart[slug] || 0;
      if (p.in_stock === false) {
        ws.innerHTML = `<div class="price">${money(p.price_cents)}<small>${esc(p.unit || "Wholesale")}</small></div><div class="oos">Out of stock — ask us</div>`;
        return;
      }
      ws.innerHTML = `
        <div class="price">${money(p.price_cents)}<small>${esc(p.unit || "Wholesale unit")}${p.min_order_qty > 1 ? " · min " + p.min_order_qty : ""}</small></div>
        <div class="ws-add-row">
          <div class="ws-qty">
            <button type="button" data-d="-1">\u2212</button>
            <input type="text" inputmode="numeric" value="${qty || p.min_order_qty || 1}">
            <button type="button" data-d="1">+</button>
          </div>
          <button class="btn ${qty ? "btn-water" : "btn-amber"}" type="button" data-add>${qty ? "In order \u2713" : "Add to order"}</button>
        </div>`;
      const input = ws.querySelector("input");
      ws.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => {
        let v = Math.max(p.min_order_qty || 1, (parseInt(input.value, 10) || 0) + parseInt(b.dataset.d, 10));
        input.value = v;
      });
      ws.querySelector("[data-add]").onclick = () => {
        const v = Math.max(p.min_order_qty || 1, parseInt(input.value, 10) || 1);
        cart[slug] = v; saveCart(); augmentCards(); renderHeader();
      };
    });
  }

  const cartCount = () => Object.values(cart).reduce((a, b) => a + (b || 0), 0);
  const cartSubtotal = () => Object.entries(cart).reduce((s, [slug, q]) => s + (priceMap[slug] ? priceMap[slug].price_cents * q : 0), 0);

  /* ---------- cart drawer ---------- */
  let drawer;
  function buildDrawer() {
    drawer = el("div", "ws-drawer");
    drawer.innerHTML = `<div class="veil"></div>
      <aside class="ws-panel">
        <header><h3>Your wholesale order</h3><button class="x">\u00d7</button></header>
        <div class="ws-lines"></div>
        <div class="ws-foot">
          <div class="sum"><span>Subtotal</span><span class="sub-val">$0.00</span></div>
          <div class="ws-msg" id="wsCartMsg"></div>
          <button class="btn btn-amber" id="wsPayCard" style="justify-content:center">Pay now by card</button>
          <button class="btn btn-outline" id="wsInvoice" style="justify-content:center">Place order \u2014 invoice me</button>
          <div class="note">Card payment activates once Stripe is connected. Invoicing is live now: submit the order and Golden West bills you on your terms.</div>
        </div>
      </aside>`;
    document.body.appendChild(drawer);
    drawer.querySelector(".veil").onclick = closeDrawer;
    drawer.querySelector(".x").onclick = closeDrawer;
    drawer.querySelector("#wsInvoice").onclick = () => placeOrder("invoice");
    drawer.querySelector("#wsPayCard").onclick = () => placeOrder("card");
  }
  function openDrawer() { if (!drawer) buildDrawer(); renderDrawer(); drawer.classList.add("open"); }
  function closeDrawer() { if (drawer) drawer.classList.remove("open"); }
  function renderDrawer() {
    if (!drawer) return;
    const lines = drawer.querySelector(".ws-lines");
    const entries = Object.entries(cart).filter(([s, q]) => q > 0 && priceMap[s]);
    if (!entries.length) { lines.innerHTML = `<div class="ws-empty">No items yet. Add products from the catalog.</div>`; }
    else {
      lines.innerHTML = entries.map(([slug, q]) => {
        const p = priceMap[slug];
        return `<div class="ws-line"><div class="nm">${esc(p.name)}<small>${money(p.price_cents)} \u00d7 ${q}${p.sku ? " · " + esc(p.sku) : ""}</small></div>
          <div class="lp">${money(p.price_cents * q)}</div><button class="rm" data-rm="${esc(slug)}">\u00d7</button></div>`;
      }).join("");
      lines.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { delete cart[b.dataset.rm]; saveCart(); renderDrawer(); augmentCards(); renderHeader(); });
    }
    drawer.querySelector(".sub-val").textContent = money(cartSubtotal());
  }

  /* ---------- place order ---------- */
  async function placeOrder(kind) {
    const msg = drawer.querySelector("#wsCartMsg");
    msg.className = "ws-msg";
    const entries = Object.entries(cart).filter(([s, q]) => q > 0 && priceMap[s]);
    if (!entries.length) { msg.className = "ws-msg err"; msg.textContent = "Your order is empty."; return; }
    if (kind === "card") {
      msg.className = "ws-msg ok";
      msg.textContent = "Card checkout is almost ready — Stripe is being connected. For now, use \u201cinvoice me\u201d and Golden West will follow up.";
      return;
    }
    const btn = drawer.querySelector("#wsInvoice");
    btn.disabled = true; const orig = btn.textContent; btn.textContent = "Submitting\u2026";
    try {
      const subtotal = cartSubtotal();
      const { data: order, error: oe } = await sb.from("orders")
        .insert({ account_id: account.id, status: "pending", subtotal_cents: subtotal, notes: "Invoice / net-terms request" })
        .select("id").single();
      if (oe) throw oe;
      const items = entries.map(([slug, q]) => {
        const p = priceMap[slug];
        return { order_id: order.id, product_id: p.product_id, product_name: p.name, sku: p.sku || null, qty: q, unit_price_cents: p.price_cents };
      });
      const { error: ie } = await sb.from("order_items").insert(items);
      if (ie) throw ie;
      cart = {}; saveCart(); renderDrawer(); augmentCards(); renderHeader();
      msg.className = "ws-msg ok";
      msg.innerHTML = "<strong>Order received.</strong> Golden West will confirm pricing and delivery, then invoice you. Thank you!";
    } catch (e) {
      msg.className = "ws-msg err"; msg.textContent = "Could not submit: " + (e.message || e);
    } finally { btn.disabled = false; btn.textContent = orig; }
  }

  /* ---------- modals (login / request / account) ---------- */
  let modal;
  function ensureModal() { if (modal) return; modal = el("div", "ws-modal"); modal.innerHTML = `<div class="veil"></div><div class="ws-card"><button class="x">\u00d7</button><div class="ws-body"></div></div>`; document.body.appendChild(modal); modal.querySelector(".veil").onclick = closeModal; modal.querySelector(".x").onclick = closeModal; }
  function closeModal() { if (modal) modal.classList.remove("open"); }
  function openModal(view) {
    ensureModal();
    const body = modal.querySelector(".ws-body");
    if (view === "login") body.innerHTML = loginHTML();
    else if (view === "request") body.innerHTML = requestHTML();
    else if (view === "account") body.innerHTML = accountHTML();
    wireModal(view, body);
    modal.classList.add("open");
  }
  function loginHTML() {
    return `<h3>Wholesale login</h3><p class="sub">Approved accounts see pricing and can place orders.</p>
      <div class="ws-msg" id="m"></div>
      <div class="ws-field"><label>Email</label><input id="e" type="email" autocomplete="email"></div>
      <div class="ws-field"><label>Password</label><input id="p" type="password" autocomplete="current-password"></div>
      <button class="btn btn-amber" id="go" style="width:100%;justify-content:center">Log in</button>
      <div class="swap">New here? <a id="toReq">Request a wholesale account</a></div>`;
  }
  function requestHTML() {
    return `<h3>Request wholesale access</h3><p class="sub">Tell us about your business. Once approved you'll see pricing and can order online.</p>
      <div class="ws-msg" id="m"></div>
      <div class="ws-field"><label>Business name</label><input id="business_name"></div>
      <div class="ws-row2">
        <div class="ws-field"><label>Your name</label><input id="contact_name" autocomplete="name"></div>
        <div class="ws-field"><label>Phone</label><input id="phone" type="tel" autocomplete="tel"></div>
      </div>
      <div class="ws-field"><label>Business type</label><select id="business_type">
        <option value="">\u2014</option><option>Car wash</option><option>Express tunnel</option><option>Auto detailer</option><option>Fleet / truck wash</option><option>Distributor / reseller</option><option>Other</option></select></div>
      <div class="ws-row2">
        <div class="ws-field"><label>City &amp; State</label><input id="city_state"></div>
        <div class="ws-field"><label>ZIP</label><input id="zip" inputmode="numeric"></div>
      </div>
      <div class="ws-field"><label>Email</label><input id="email" type="email" autocomplete="email"></div>
      <div class="ws-field"><label>Create a password</label><input id="password" type="password" autocomplete="new-password"></div>
      <button class="btn btn-amber" id="go" style="width:100%;justify-content:center">Submit request</button>
      <div class="swap">Already have an account? <a id="toLogin">Log in</a></div>`;
  }
  function accountHTML() {
    const st = account ? account.status : "";
    const badge = st === "approved" ? "" : `<div class="ws-pending">Your account is <strong>pending approval</strong>. Golden West will review it shortly \u2014 you'll see pricing here once approved.</div>`;
    return `<h3>${esc(account ? account.business_name : "Account")}</h3><p class="sub">${esc((account && account.email) || "")}</p>
      ${badge}
      <button class="btn btn-outline" id="logout" style="width:100%;justify-content:center">Log out</button>`;
  }
  function wireModal(view, body) {
    const m = body.querySelector("#m");
    const show = (cls, txt) => { if (!m) return; m.className = "ws-msg " + cls; m.innerHTML = txt; };
    if (view === "login") {
      body.querySelector("#toReq").onclick = () => openModal("request");
      body.querySelector("#go").onclick = async () => {
        const email = body.querySelector("#e").value.trim().toLowerCase();
        const password = body.querySelector("#p").value;
        if (!email || !password) return show("err", "Enter your email and password.");
        show("", ""); const btn = body.querySelector("#go"); btn.disabled = true; btn.textContent = "Logging in\u2026";
        const { error } = await sb.auth.signInWithPassword({ email, password });
        btn.disabled = false; btn.textContent = "Log in";
        if (error) return show("err", "Login failed: " + error.message);
        await loadAccount(); closeModal();
        if (!approved()) openModal("account");
      };
    } else if (view === "request") {
      body.querySelector("#toLogin").onclick = () => openModal("login");
      body.querySelector("#go").onclick = async () => {
        const payload = {};
        ["business_name", "contact_name", "phone", "business_type", "city_state", "zip", "email", "password"].forEach((k) => payload[k] = (body.querySelector("#" + k).value || "").trim());
        if (!payload.business_name || !payload.email || payload.password.length < 6) return show("err", "Business name, email, and a 6+ character password are required.");
        const btn = body.querySelector("#go"); btn.disabled = true; btn.textContent = "Submitting\u2026";
        try {
          const r = await fetch(REQUEST_FN, { method: "POST", headers: { "Content-Type": "application/json", "apikey": cfg.SUPABASE_ANON_KEY }, body: JSON.stringify(payload) });
          const j = await r.json();
          if (!r.ok || j.error) throw new Error(j.error || "Request failed");
          // auto sign-in so their status shows immediately
          await sb.auth.signInWithPassword({ email: payload.email, password: payload.password });
          await loadAccount();
          show("ok", "<strong>Request submitted.</strong> You're logged in \u2014 pricing unlocks once Golden West approves your account.");
          setTimeout(() => { closeModal(); if (!approved()) openModal("account"); }, 1400);
        } catch (e) { show("err", e.message || String(e)); btn.disabled = false; btn.textContent = "Submit request"; }
      };
    } else if (view === "account") {
      body.querySelector("#logout").onclick = async () => { await sb.auth.signOut(); account = null; session = null; cart = {}; saveCart(); closeModal(); refresh(); };
    }
  }

  /* ---------- data loading ---------- */
  async function loadAccount() {
    const { data: s } = await sb.auth.getSession();
    session = s ? s.session : null;
    account = null; priceMap = {};
    if (!session) return refresh();
    const { data: rows } = await sb.from("wholesale_accounts").select("*").eq("user_id", session.user.id).limit(1);
    account = rows && rows[0] ? rows[0] : null;
    if (approved()) await loadPrices();
    refresh();
  }
  async function loadPrices() {
    const { data, error } = await sb.from("product_prices")
      .select("product_id, price_cents, unit, min_order_qty, in_stock, products(slug, name_en, sku)");
    if (error || !data) return;
    priceMap = {};
    data.forEach((r) => {
      const slug = r.products && r.products.slug;
      if (slug) priceMap[slug] = { product_id: r.product_id, price_cents: r.price_cents, unit: r.unit, min_order_qty: r.min_order_qty || 1, in_stock: r.in_stock, name: (r.products && r.products.name_en) || slug, sku: r.products && r.products.sku };
    });
  }

  function refresh() { renderHeader(); augmentCards(); renderDrawer(); }

  /* ---------- init ---------- */
  function watchGrid() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(augmentCards, 30); }).observe(grid, { childList: true });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    injectStyles();
    watchGrid();
    sb.auth.onAuthStateChange((_e, s) => { session = s; });
    await loadAccount();
  });

  // expose modal openers so in-page buttons (e.g. the Wholesale page) can trigger them
  window.GW_WS = { openLogin: () => openModal("login"), openRequest: () => openModal("request") };
})();

/* ===== Golden West — RETAIL storefront layer (public) =====
   Runs on /shop only. Shows public retail prices, size + quantity pickers,
   a cart, and guest checkout. Prices are recomputed server-side at checkout
   (place_retail_order RPC) so the browser can't tamper with totals.
   The wholesale experience lives separately on /wholesale (shop.js). */
(function () {
  const cfg = window.GW_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  let priceMap = {};                 // slug -> { product_id, cents, in_stock }
  let cart = {};                     // key(slug|size) -> { slug, product_id, size, qty, name, cents }
  try { cart = JSON.parse(localStorage.getItem("gw_retail_cart") || "{}"); } catch (e) { cart = {}; }

  const money = (c) => "$" + (Number(c || 0) / 100).toFixed(2);
  const save = () => localStorage.setItem("gw_retail_cart", JSON.stringify(cart));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const count = () => Object.values(cart).reduce((n, c) => n + c.qty, 0);
  const subtotal = () => Object.values(cart).reduce((n, c) => n + c.qty * c.cents, 0);
  const keyOf = (slug, size) => slug + "|" + (size || "");

  /* ---------- styles ---------- */
  function injectStyles() {
    const css = `
    body.retail .card .add{display:none}
    body.retail .tray-btn{display:none!important}
    .rt{margin-top:auto;border-top:1px dashed var(--line);padding-top:12px;display:flex;flex-direction:column;gap:9px}
    .rt .price{font-family:var(--font-d);font-size:1.5rem;color:var(--navy);font-weight:700;line-height:1}
    .rt .price small{font-family:var(--font-m);font-size:.6rem;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;display:block;margin-top:3px}
    .rt .oos{font-family:var(--font-m);font-size:.72rem;color:#a12626;text-transform:uppercase;letter-spacing:.08em}
    .rt .opts{display:flex;gap:8px;align-items:center}
    .rt select{flex:1;border:1.5px solid var(--line);border-radius:9px;padding:.5em .6em;font-family:var(--font-b);font-size:.9rem;background:#fff;color:var(--ink)}
    .rt-qty{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:9px;overflow:hidden}
    .rt-qty button{background:var(--paper);border:0;width:30px;height:36px;cursor:pointer;font-size:1.15rem;color:var(--navy);line-height:1}
    .rt-qty input{width:40px;height:36px;border:0;text-align:center;font-family:var(--font-m);font-size:.9rem;color:var(--ink)}
    .rt .btn{width:100%;justify-content:center}
    .rt-cartbtn{position:relative}
    .rt-cartbtn .n{position:absolute;top:-7px;right:-7px;background:var(--water);color:#fff;font-family:var(--font-m);font-size:.66rem;min-width:18px;height:18px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
    .rt-drawer{position:fixed;inset:0;z-index:120;display:none}
    .rt-drawer.open{display:block}
    .rt-drawer .veil{position:absolute;inset:0;background:rgba(11,42,69,.5)}
    .rt-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,95vw);background:#fff;box-shadow:-12px 0 40px -18px rgba(0,0,0,.5);display:flex;flex-direction:column}
    .rt-panel header{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
    .rt-panel header h3{font-family:var(--font-d);color:var(--navy);font-size:1.3rem}
    .rt-panel .x{background:none;border:0;font-size:1.5rem;cursor:pointer;color:var(--muted);line-height:1}
    .rt-lines{flex:1;overflow:auto;padding:12px 20px}
    .rt-line{display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .rt-line .nm{flex:1;font-size:.92rem;color:var(--navy);font-weight:600}
    .rt-line .nm small{display:block;color:var(--muted);font-weight:400;font-family:var(--font-m);font-size:.72rem}
    .rt-line .lp{font-family:var(--font-d);color:var(--navy);font-weight:700;white-space:nowrap}
    .rt-line .rm{background:none;border:0;color:#a12626;cursor:pointer;font-size:1rem}
    .rt-foot{border-top:1px solid var(--line);padding:18px 20px;display:flex;flex-direction:column;gap:12px}
    .rt-foot .sum{display:flex;justify-content:space-between;font-family:var(--font-d);font-size:1.25rem;color:var(--navy);font-weight:700}
    .rt-foot .note{font-size:.8rem;color:var(--muted)}
    .rt-empty{color:var(--muted);text-align:center;padding:40px 0}
    .rt-modal{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;padding:18px}
    .rt-modal.open{display:flex}
    .rt-modal .veil{position:absolute;inset:0;background:rgba(11,42,69,.55)}
    .rt-card{position:relative;background:#fff;border-radius:16px;box-shadow:var(--shadow);width:min(470px,96vw);max-height:92vh;overflow:auto;padding:26px}
    .rt-card h3{font-family:var(--font-d);color:var(--navy);font-size:1.5rem;margin-bottom:6px}
    .rt-card .sub{color:var(--muted);margin-bottom:16px;font-size:.95rem}
    .rt-card .x{position:absolute;top:14px;right:16px;background:none;border:0;font-size:1.5rem;cursor:pointer;color:var(--muted)}
    .rt-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
    .rt-field label{font-family:var(--font-d);font-weight:600;font-size:.9rem;color:var(--navy)}
    .rt-field input,.rt-field textarea{border:1.5px solid var(--line);border-radius:9px;padding:.66em .8em;font-family:var(--font-b);font-size:1rem}
    .rt-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .rt-msg{border-radius:9px;padding:11px 13px;font-size:.9rem;margin-bottom:12px;display:none}
    .rt-msg.ok{display:block;background:#e8f5ec;border:1px solid #b7dfc3;color:#1c6b39}
    .rt-msg.err{display:block;background:#fdecec;border:1px solid #f3c3c3;color:#a12626}
    `;
    document.head.appendChild(el("style", null, css));
  }

  /* ---------- header cart button ---------- */
  function renderHeader() {
    const right = document.querySelector(".hdr-right");
    if (!right) return;
    let box = document.getElementById("rtCart");
    if (!box) { box = el("div", "ws-acct"); box.id = "rtCart"; right.insertBefore(box, right.querySelector(".burger")); }
    const n = count();
    box.innerHTML = `<button class="ws-btn solid rt-cartbtn" id="rtCartBtn">Cart${n ? ` <span class="n">${n}</span>` : ""}</button>`;
    box.querySelector("#rtCartBtn").onclick = openDrawer;
  }

  /* ---------- pricing + controls on each card ---------- */
  function augmentCards() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    grid.querySelectorAll(".card").forEach((card) => {
      const addBtn = card.querySelector(".add");
      const slug = addBtn && addBtn.dataset.id;
      if (!slug) return;
      const p = priceMap[slug];
      let rt = card.querySelector(".rt");
      if (!p) { if (rt) rt.remove(); return; }
      if (!rt) { rt = el("div", "rt"); card.appendChild(rt); }
      if (p.in_stock === false) {
        rt.innerHTML = `<div class="price">${money(p.cents)}<small>Retail</small></div><div class="oos">Out of stock</div>`;
        return;
      }
      const sizes = Array.from(card.querySelectorAll(".sizes .chip")).map((c) => c.textContent.trim()).filter(Boolean);
      const sizeSel = sizes.length
        ? `<select class="rt-size">${sizes.map((s) => `<option>${esc(s)}</option>`).join("")}</select>`
        : "";
      rt.innerHTML = `
        <div class="price">${money(p.cents)}<small>Retail · per unit</small></div>
        <div class="opts">
          ${sizeSel}
          <div class="rt-qty"><button type="button" data-d="-1">\u2212</button><input type="text" inputmode="numeric" value="1"><button type="button" data-d="1">+</button></div>
        </div>
        <button class="btn btn-amber rt-add" type="button">Add to cart</button>`;
      const qtyInput = rt.querySelector(".rt-qty input");
      rt.querySelectorAll(".rt-qty button").forEach((b) => b.onclick = () => {
        let v = parseInt(qtyInput.value || "1", 10) || 1; v = Math.max(1, v + parseInt(b.dataset.d, 10)); qtyInput.value = v;
      });
      rt.querySelector(".rt-add").onclick = () => {
        const size = rt.querySelector(".rt-size") ? rt.querySelector(".rt-size").value : "";
        const qty = Math.max(1, parseInt(qtyInput.value || "1", 10) || 1);
        const name = (card.querySelector("h3") || {}).textContent || slug;
        const k = keyOf(slug, size);
        cart[k] = { slug, product_id: p.product_id, size, qty: (cart[k] ? cart[k].qty : 0) + qty, name, cents: p.cents };
        save(); renderHeader(); flashCart();
      };
    });
  }
  function flashCart() {
    const b = document.getElementById("rtCartBtn");
    if (b) b.animate([{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 240 });
    openDrawer();
  }

  /* ---------- cart drawer ---------- */
  let drawer;
  function ensureDrawer() {
    if (drawer) return;
    drawer = el("div", "rt-drawer");
    drawer.innerHTML = `<div class="veil"></div>
      <div class="rt-panel">
        <header><h3>Your cart</h3><button class="x" aria-label="Close">\u00d7</button></header>
        <div class="rt-lines"></div>
        <div class="rt-foot"></div>
      </div>`;
    document.body.appendChild(drawer);
    drawer.querySelector(".veil").onclick = closeDrawer;
    drawer.querySelector(".x").onclick = closeDrawer;
  }
  function renderDrawer() {
    if (!drawer) return;
    const lines = drawer.querySelector(".rt-lines"), foot = drawer.querySelector(".rt-foot");
    const items = Object.entries(cart);
    if (!items.length) {
      lines.innerHTML = `<div class="rt-empty">Your cart is empty.</div>`;
      foot.innerHTML = ""; return;
    }
    lines.innerHTML = items.map(([k, c]) => `
      <div class="rt-line" data-k="${esc(k)}">
        <div class="nm">${esc(c.name)}<small>${c.size ? esc(c.size) + " · " : ""}${money(c.cents)} × ${c.qty}</small></div>
        <div class="lp">${money(c.cents * c.qty)}</div>
        <button class="rm" title="Remove">\u2715</button>
      </div>`).join("");
    lines.querySelectorAll(".rt-line .rm").forEach((b) => b.onclick = () => {
      delete cart[b.closest(".rt-line").dataset.k]; save(); renderHeader(); renderDrawer();
    });
    foot.innerHTML = `
      <div class="sum"><span>Subtotal</span><span>${money(subtotal())}</span></div>
      <div class="note">Taxes &amp; delivery calculated at confirmation. Free delivery within 50 mi on orders $500+.</div>
      <button class="btn btn-amber" id="rtCheckout" style="justify-content:center">Checkout</button>`;
    foot.querySelector("#rtCheckout").onclick = openCheckout;
  }
  function openDrawer() { ensureDrawer(); renderDrawer(); drawer.classList.add("open"); }
  function closeDrawer() { if (drawer) drawer.classList.remove("open"); }

  /* ---------- checkout modal ---------- */
  let modal;
  function ensureModal() {
    if (modal) return;
    modal = el("div", "rt-modal");
    modal.innerHTML = `<div class="veil"></div><div class="rt-card"><button class="x" aria-label="Close">\u00d7</button><div class="rt-body"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".veil").onclick = () => modal.classList.remove("open");
    modal.querySelector(".x").onclick = () => modal.classList.remove("open");
  }
  function openCheckout() {
    if (!count()) return;
    ensureModal();
    const body = modal.querySelector(".rt-body");
    body.innerHTML = `
      <h3>Checkout</h3><p class="sub">${count()} item(s) · ${money(subtotal())}</p>
      <div class="rt-msg" id="m"></div>
      <div class="rt-field"><label>Full name</label><input id="c_name" autocomplete="name"></div>
      <div class="rt-row2">
        <div class="rt-field"><label>Email</label><input id="c_email" type="email" autocomplete="email"></div>
        <div class="rt-field"><label>Phone</label><input id="c_phone" type="tel" autocomplete="tel"></div>
      </div>
      <div class="rt-field"><label>Delivery address</label><textarea id="c_address" rows="2" autocomplete="street-address"></textarea></div>
      <button class="btn btn-amber" id="rtPlace" style="width:100%;justify-content:center">Place order · ${money(subtotal())}</button>
      <p class="sub" style="margin:12px 0 0;font-size:.82rem">Secure card payment is being activated. Submit your order and Golden West will confirm and take payment.</p>`;
    closeDrawer(); modal.classList.add("open");
    const show = (cls, txt) => { const m = body.querySelector("#m"); m.className = "rt-msg " + cls; m.innerHTML = txt; };
    body.querySelector("#rtPlace").onclick = async () => {
      const customer = {
        name: body.querySelector("#c_name").value.trim(),
        email: body.querySelector("#c_email").value.trim(),
        phone: body.querySelector("#c_phone").value.trim(),
        address: body.querySelector("#c_address").value.trim(),
      };
      if (!customer.email || !customer.name) return show("err", "Please enter your name and email.");
      const items = Object.values(cart).map((c) => ({ product_id: c.product_id, size: c.size, qty: c.qty }));
      const btn = body.querySelector("#rtPlace"); btn.disabled = true; btn.textContent = "Placing order\u2026";
      try {
        const { data, error } = await sb.rpc("place_retail_order", { customer, items });
        if (error || !data) throw new Error(error ? error.message : "Could not place order");
        cart = {}; save(); renderHeader();
        body.innerHTML = `<h3>Order received \u2713</h3>
          <p class="sub">Thank you, ${esc(customer.name)}. Your order reference is <strong>#${String(data).slice(0, 8)}</strong>.</p>
          <div class="rt-msg ok" style="display:block">Golden West will confirm your order and delivery, and take secure payment. A copy goes to ${esc(customer.email)}.</div>
          <button class="btn btn-amber" style="width:100%;justify-content:center" onclick="this.closest('.rt-modal').classList.remove('open')">Done</button>`;
      } catch (e) {
        show("err", (e && e.message) || String(e)); btn.disabled = false; btn.textContent = "Place order";
      }
    };
  }

  /* ---------- data + init ---------- */
  async function loadPrices() {
    const { data, error } = await sb.from("product_retail")
      .select("product_id, retail_cents, in_stock, products(slug)");
    if (error || !data) return;
    priceMap = {};
    data.forEach((r) => {
      const slug = r.products && r.products.slug;
      if (slug) priceMap[slug] = { product_id: r.product_id, cents: r.retail_cents, in_stock: r.in_stock };
    });
  }
  function watchGrid() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(augmentCards, 30); }).observe(grid, { childList: true });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("retail");
    injectStyles();
    renderHeader();
    watchGrid();
    await loadPrices();
    augmentCards();
  });
})();

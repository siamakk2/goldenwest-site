/* Golden West — "Ask us" on-site AI assistant. Grounded via /functions/v1/sitechat. */
(function () {
  "use strict";
  var API = "https://oxbklxjsbljpjzwpizip.supabase.co/functions/v1/sitechat";
  var KEY = "gw-chat-2026";

  var I18N = {
    en: { launch: "Ask us", title: "Golden West Assistant", sub: "Answers from our catalog only",
      ph: "Type a question…", hello: "Hi! Ask me anything about our products, wholesale pricing, delivery, or hours.",
      chips: ["Best soap for a touchless wash?", "Do you deliver to my ZIP?", "How do I get wholesale pricing?"],
      err: "Sorry — I couldn't reach the assistant. Please call (310) 538-0918." },
    es: { launch: "Pregúntanos", title: "Asistente Golden West", sub: "Responde solo con nuestro catálogo",
      ph: "Escriba su pregunta…", hello: "¡Hola! Pregúnteme sobre productos, precios de mayoreo, entregas u horarios.",
      chips: ["¿Jabón para lavado sin contacto?", "¿Entregan en mi código postal?", "¿Cómo obtengo precio de mayoreo?"],
      err: "No pude conectar con el asistente. Llame al (310) 213-3171." },
    ko: { launch: "문의하기", title: "Golden West 상담", sub: "카탈로그 기반 답변",
      ph: "질문을 입력하세요…", hello: "안녕하세요! 제품, 도매 가격, 배송, 영업시간을 물어보세요.",
      chips: ["터치리스용 세제 추천?", "우리 지역 배송 되나요?", "도매 가격은 어떻게?"],
      err: "상담에 연결할 수 없습니다. (310) 538-0918로 전화해 주세요." },
  };

  var lang = "en";
  try { lang = localStorage.getItem("gw_lang") || "en"; } catch (e) {}
  if (!I18N[lang]) lang = "en";
  var T = I18N[lang];

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem("gw_chat") || "[]"); } catch (e) {}

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  var launcher = document.createElement("button");
  launcher.className = "gwc-launch";
  launcher.innerHTML = '<span class="gwc-dot"></span>💬 <span>' + esc(T.launch) + "</span>";
  document.body.appendChild(launcher);

  var box = document.createElement("div");
  box.className = "gwc-box";
  box.innerHTML =
    '<div class="gwc-head"><div><b>' + esc(T.title) + "</b><span>" + esc(T.sub) + '</span></div><button class="gwc-x" aria-label="Close">&times;</button></div>' +
    '<div class="gwc-log"></div>' +
    '<div class="gwc-chips"></div>' +
    '<form class="gwc-form"><input type="text" maxlength="500" placeholder="' + esc(T.ph) + '" /><button type="submit" class="gwc-send" aria-label="Send">➤</button></form>';
  document.body.appendChild(box);

  var log = box.querySelector(".gwc-log"), chipsEl = box.querySelector(".gwc-chips"),
      form = box.querySelector(".gwc-form"), input = form.querySelector("input");

  function bubble(role, html) {
    var d = document.createElement("div");
    d.className = "gwc-m " + (role === "user" ? "gwc-u" : "gwc-a");
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function renderExtras(d, data) {
    var h = "";
    (data.links || []).forEach(function (l) {
      if (l && l.u && String(l.u).charAt(0) === "/") h += '<a class="gwc-link" href="' + esc(l.u) + '">' + esc(l.t || l.u) + "</a>";
    });
    (data.products || []).forEach(function (p) {
      h += '<a class="gwc-prod" href="/shop?p=' + encodeURIComponent(p.slug) + '">' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" />' : "") + "<span>" + esc(p.name) + "</span></a>";
    });
    if (h) { var w = document.createElement("div"); w.className = "gwc-extras"; w.innerHTML = h; d.appendChild(w); log.scrollTop = log.scrollHeight; }
  }

  function restore() {
    log.innerHTML = "";
    bubble("assistant", esc(T.hello));
    history.forEach(function (m) { bubble(m.role === "user" ? "user" : "assistant", esc(m.content)); });
    renderChips();
  }
  function renderChips() {
    if (history.length) { chipsEl.innerHTML = ""; return; }
    chipsEl.innerHTML = T.chips.map(function (c) { return '<button type="button">' + esc(c) + "</button>"; }).join("");
    chipsEl.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { send(b.textContent); });
    });
  }

  var busy = false;
  function send(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    chipsEl.innerHTML = "";
    bubble("user", esc(text));
    history.push({ role: "user", content: text });
    var think = bubble("assistant", '<span class="gwc-think"><i></i><i></i><i></i></span>');
    fetch(API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: KEY, lang: lang, messages: history.slice(-8) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error("bad");
        think.innerHTML = esc(d.answer || "");
        renderExtras(think, d);
        history.push({ role: "assistant", content: d.answer || "" });
        if (history.length > 12) history = history.slice(-12);
        try { sessionStorage.setItem("gw_chat", JSON.stringify(history)); } catch (e) {}
      })
      .catch(function () { think.innerHTML = esc(T.err); history.pop(); })
      .finally(function () { busy = false; input.focus(); });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; send(v); });
  launcher.addEventListener("click", function () {
    var open = box.classList.toggle("on");
    launcher.classList.toggle("hide", open);
    if (open) { restore(); setTimeout(function () { input.focus(); }, 60); }
  });
  box.querySelector(".gwc-x").addEventListener("click", function () {
    box.classList.remove("on"); launcher.classList.remove("hide");
  });
})();

/* Golden West — motion & depth effects. GPU-only transforms, reduced-motion aware. */
(function () {
  "use strict";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePtr = matchMedia("(pointer: fine)").matches;
  if (reduced) return;

  /* ---- staggered reveals: cascade siblings ---- */
  function stagger() {
    var groups = {};
    document.querySelectorAll(".reveal").forEach(function (el) {
      var p = el.parentElement;
      if (!p) return;
      var k = p.dataset.fxg || (p.dataset.fxg = Math.random().toString(36).slice(2));
      groups[k] = groups[k] || [];
      groups[k].push(el);
    });
    Object.keys(groups).forEach(function (k) {
      groups[k].forEach(function (el, i) {
        el.style.setProperty("--rd", Math.min(i * 0.09, 0.45) + "s");
      });
    });
  }

  /* ---- 3D pointer tilt on cards ---- */
  function tilt() {
    if (!finePtr) return;
    var sel = ".card, .step, .stat, .seo-facts > div, .label";
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    var raf = 0, target = null, ev = null;
    function onMove(e) {
      var el = e.target.closest && e.target.closest(sel);
      if (target && el !== target) reset(target);
      target = el; ev = e;
      if (el && !raf) raf = requestAnimationFrame(apply);
    }
    function onOut(e) {
      var el = e.target.closest && e.target.closest(sel);
      if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) reset(el);
    }
    function apply() {
      raf = 0;
      if (!target || !ev) return;
      var r = target.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width - 0.5;
      var py = (ev.clientY - r.top) / r.height - 0.5;
      var isLabel = target.classList.contains("label");
      var max = isLabel ? 7 : 5;
      var rot = "";
      var m = (target.className.match(/\bl([123])\b/) || [])[1];
      if (m) rot = " rotate(" + { 1: "-4deg", 2: "3.5deg", 3: "-2deg" }[m] + ")";
      target.style.transform =
        "perspective(850px) rotateX(" + (-py * max).toFixed(2) + "deg) rotateY(" + (px * max).toFixed(2) + "deg) translateY(-4px)" + rot;
      target.style.boxShadow = "0 24px 48px -20px rgba(11,42,69,.45)";
      target.style.zIndex = "5";
    }
    function reset(el) {
      el.style.transform = ""; el.style.boxShadow = ""; el.style.zIndex = "";
    }
  }

  /* ---- hero depth parallax: labels drift with the pointer ---- */
  function heroDepth() {
    if (!finePtr) return;
    var hero = document.querySelector(".hero");
    var labels = hero && hero.querySelectorAll(".label");
    if (!hero || !labels || !labels.length) return;
    var depths = [14, 22, 10], raf = 0, cx = 0, cy = 0;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      cx = (e.clientX - r.left) / r.width - 0.5;
      cy = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(go);
    }, { passive: true });
    hero.addEventListener("pointerleave", function () {
      labels.forEach(function (l) { l.style.translate = ""; });
    }, { passive: true });
    function go() {
      raf = 0;
      labels.forEach(function (l, i) {
        var d = depths[i % depths.length];
        l.style.translate = (-cx * d).toFixed(1) + "px " + (-cy * d).toFixed(1) + "px";
      });
    }
  }

  /* ---- foam bubbles drifting in the hero ---- */
  function foam() {
    var host = document.querySelector(".hero") || document.querySelector(".pagehead-hero");
    if (!host) return;
    for (var i = 0; i < 7; i++) {
      var b = document.createElement("span");
      b.className = "fxfoam";
      var s = 14 + Math.random() * 54;
      b.style.width = b.style.height = s.toFixed(0) + "px";
      b.style.left = (4 + Math.random() * 92) + "%";
      b.style.top = (18 + Math.random() * 70) + "%";
      b.style.setProperty("--d", (6 + Math.random() * 7).toFixed(1) + "s");
      b.style.setProperty("--dl", (-Math.random() * 6).toFixed(1) + "s");
      b.style.opacity = (0.18 + Math.random() * 0.3).toFixed(2);
      host.appendChild(b);
    }
  }

  /* ---- animated stat counters ---- */
  function countUp() {
    var stats = document.querySelectorAll(".stat b");
    if (!stats.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        run(en.target);
      });
    }, { threshold: 0.6 });
    stats.forEach(function (s) { io.observe(s); });
    function run(el) {
      var m = el.textContent.match(/^(\d+)(.*)$/);
      if (!m) return;
      var n = parseInt(m[1], 10), suf = m[2] || "", t0 = null, dur = 1200;
      function frame(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        p = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(n * p) + suf;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }

  function init() { stagger(); tilt(); heroDepth(); foam(); countUp(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

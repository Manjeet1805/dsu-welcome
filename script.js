(function () {
  var cfg = window.SITE_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  $("year").textContent = new Date().getFullYear();

  // ---------- Headline: word-by-word reveal ----------
  (function splitHeadline() {
    var h1 = $("h1"), n = 0;
    if (!h1 || reduce) return;
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w";
            var s = document.createElement("span"); s.style.setProperty("--i", n++); s.textContent = part;
            w.appendChild(s); frag.appendChild(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) { walk(c); }
      });
    }
    walk(h1);
  })();

  // ---------- Reveal on scroll ----------
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add("in"); }); }

  // ---------- Cursor spotlight, card glow, magnetic button ----------
  if (finePointer && !reduce) {
    var raf = 0, px = 0, py = 0, root = document.documentElement;
    window.addEventListener("pointermove", function (e) {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () {
        root.style.setProperty("--mx", px + "px"); root.style.setProperty("--my", py + "px"); raf = 0;
      });
    }, { passive: true });

    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--cx", (e.clientX - r.left) + "px");
        card.style.setProperty("--cy", (e.clientY - r.top) + "px");
      });
    });

    document.querySelectorAll(".btn-magnetic").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.18;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.28;
        b.style.transform = "translate(" + x + "px," + y + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  // ---------- Scroll progress + sticky CTA ----------
  var bar = $("progress"), sticky = $("stickyCta"), vs = $("videoSection"), ap = $("apply");
  var ticking = false;
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ")";
    var v = vs.getBoundingClientRect(), a = ap.getBoundingClientRect();
    sticky.classList.toggle("show", v.bottom < 60 && a.top > window.innerHeight - 240);
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // ---------- Meta Pixel (optional) ----------
  function track(type, name, data) {
    try { if (window.fbq) window.fbq(type, name, data || {}); } catch (e) {}
  }
  if (cfg.PIXEL_ID) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq("init", cfg.PIXEL_ID);
    window.fbq("track", "PageView");
  }

  // ---------- Ad parameters (UTM, Meta IDs) -> Typeform hidden fields ----------
  var KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","campaign_id","adset_id","ad_id","fbclid"];
  function readParams() {
    var out = {};
    [location.search, location.hash.replace(/^#/, "")].forEach(function (str) {
      try {
        new URLSearchParams(str.replace(/^\?/, "")).forEach(function (v, k) { if (KEYS.indexOf(k) > -1 && v) out[k] = v; });
      } catch (e) {}
    });
    try {
      if (Object.keys(out).length) sessionStorage.setItem("dsu_params", JSON.stringify(out));
      else out = JSON.parse(sessionStorage.getItem("dsu_params") || "{}");
    } catch (e) {}
    return out;
  }
  var hidden = readParams();

  // ---------- Video ----------
  var video = $("video"), player = $("player"), playBtn = $("playBtn"), err = $("videoError");
  var configured = cfg.VIDEO_URL && cfg.VIDEO_URL.indexOf("REPLACE") === -1;
  if (configured) {
    // "#t=0.1" lets iOS Safari show the first frame as a preview
    video.src = encodeURI(decodeURI(cfg.VIDEO_URL)) + "#t=0.1";
    if (cfg.POSTER_URL) video.poster = cfg.POSTER_URL;
  } else {
    err.hidden = false;
    err.textContent = "Video URL missing. Set VIDEO_URL in config.js.";
    playBtn.hidden = true;
  }
  video.addEventListener("error", function () { if (configured) { err.hidden = false; playBtn.hidden = true; } });

  var marks = { 25: false, 50: false, 75: false, 95: false }, started = false;
  playBtn.addEventListener("click", function () {
    video.muted = false;
    video.controls = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () { video.muted = true; video.play(); });
  });
  video.addEventListener("play", function () {
    player.classList.add("playing");
    video.controls = true;
    if (!started) { started = true; track("trackCustom", "VideoPlay"); }
  });
  video.addEventListener("timeupdate", function () {
    if (!video.duration) return;
    var pct = (video.currentTime / video.duration) * 100;
    Object.keys(marks).forEach(function (m) {
      if (!marks[m] && pct >= Number(m)) { marks[m] = true; track("trackCustom", "VideoWatched" + m); }
    });
  });
  video.addEventListener("ended", function () { vs.classList.add("done"); });
  $("toForm").addEventListener("click", function () { track("trackCustom", "ClickToForm"); });

  // ---------- Typeform embed ----------
  var formUrl = "https://" + (cfg.TYPEFORM_DOMAIN || "form.typeform.com") + "/to/" + cfg.TYPEFORM_ID;
  var qs = Object.keys(hidden).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(hidden[k]); }).join("&");
  $("formLink").href = formUrl + (qs ? "?" + qs : "");

  var mounted = false;
  function mount() {
    if (mounted || !window.tf || !window.tf.createWidget) return;
    mounted = true;
    var host = $("typeform");
    host.innerHTML = "";
    window.tf.createWidget(cfg.TYPEFORM_ID, {
      container: host,
      hidden: hidden,
      inlineOnMobile: true,
      lazy: true,
      opacity: 100,
      onReady: function () { track("trackCustom", "FormLoaded"); },
      onStarted: function () { track("trackCustom", "FormStarted"); },
      onSubmit: function () {
        track("track", "Lead");
        // Redirect to booking page with ad parameters preserved
        var redirectUrl = "https://dsu-booking.vercel.app/";
        var fbclid = hidden.fbclid;
        if (fbclid) {
          redirectUrl += "?fbclid=" + encodeURIComponent(fbclid);
        }
        setTimeout(function () { window.location.href = redirectUrl; }, 1200);
      }
    });
  }
  window.__tfReady = mount;
  if (window.tf) mount();
  // Fallback: if the embed script is blocked (adblocker), show a direct link
  setTimeout(function () {
    if (!mounted) { mount(); }
    if (!mounted) $("formFallback").hidden = false;
  }, 6000);
})();

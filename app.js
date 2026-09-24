/* FAMSE web — flow, i18n (DA/EN), player, anonymous recording. No client scoring. */
(function () {
  "use strict";
  var BANK = window.FAMSE_BANK;
  var CFG = window.FAMSE_CONFIG;
  var I18N = window.FAMSE_I18N;
  var ISI = BANK.isi_ms;
  var N_PER = CFG.sequencesPerSession || BANK.sequences_per_session;

  var LANG = "da";
  try { LANG = localStorage.getItem("famse_lang") || "da"; } catch (e) {}
  if (!I18N[LANG]) LANG = "da";

  var answers = {};                 // screening answers (language-independent values)
  var identifier = null;            // optional study code entered at start
  var IDCFG = CFG.identifier || { enabled: false };
  var $ = function (id) { return document.getElementById(id); };
  var round2 = function (x) { return Math.round(x * 100) / 100; };
  var t = function (k) { return (I18N[LANG] && I18N[LANG][k]) || I18N.da[k] || k; };

  function show(id) {
    var all = document.querySelectorAll(".screen");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
    $(id).classList.add("active");
  }

  // ---- i18n ------------------------------------------------------------
  function applyLang() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("#lang button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === LANG);
    });
    if (IDCFG.enabled) {
      $("identifierLabel").textContent = (IDCFG.label && (IDCFG.label[LANG] || IDCFG.label.da)) || "";
      $("identifierHelp").textContent = (IDCFG.help && (IDCFG.help[LANG] || IDCFG.help.da)) || "";
    }
    renderScreening();
  }
  document.querySelectorAll("#lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      LANG = b.getAttribute("data-lang");
      try { localStorage.setItem("famse_lang", LANG); } catch (e) {}
      applyLang();
    });
  });

  // Generic "data-go" navigation.
  document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-go")); });
  });

  // Start -> identifier screen (if enabled) or straight to screening.
  $("startBtn").addEventListener("click", function () {
    show(IDCFG.enabled ? "identifier" : "screening");
  });
  var idInput = $("identifierInput");
  if (idInput) {
    idInput.addEventListener("input", function () { identifier = idInput.value.trim() || null; });
  }
  $("identifierNext").addEventListener("click", function () {
    if (IDCFG.required && !identifier) { $("identifierErr").textContent = t("identifier.err"); return; }
    $("identifierErr").textContent = "";
    show("screening");
  });

  // ---- Screening -------------------------------------------------------
  // Types: number | choice | scale | yesno | text | multichoice.
  // choice/multichoice may set `other: true` -- the LAST entry in
  // options/values is then treated as "Other", revealing a free-text input
  // stored under `<id>_other`.
  // `showIf: { id, equals }` conditionally shows a question based on another
  // question's current (canonical) answer; hidden questions are skipped for
  // both rendering and required-validation, and their stored answers are
  // cleared so a stale answer from a since-changed gate never gets submitted.
  function yesnoLabels() { return LANG === "da" ? ["Ja", "Nej"] : ["Yes", "No"]; }
  function isVisible(q) {
    return !q.showIf || answers[q.showIf.id] === q.showIf.equals;
  }
  function canonOf(q, idx) {
    if (q.type === "yesno") return idx === 0 ? "yes" : "no";
    if (q.type === "choice" || q.type === "multichoice") {
      if (q.other && idx === (q.values || q.options.en).length - 1) return "other";
      return (q.values && q.values[idx]) || q.options.en[idx];
    }
    return null;
  }
  function selectedIndex(q) {
    // Map a stored canonical value back to an option index (for re-highlighting).
    var v = answers[q.id];
    if (v === undefined) return -1;
    if (q.type === "yesno") return v === "yes" ? 0 : v === "no" ? 1 : -1;
    if (q.type === "choice") {
      var codes = q.values || q.options.en;
      return codes.indexOf(v);
    }
    if (q.type === "scale") return Number(v) - q.min;
    return -1;
  }

  function clearHiddenAnswers() {
    CFG.screening.forEach(function (q) {
      if (!isVisible(q)) { delete answers[q.id]; delete answers[q.id + "_other"]; }
    });
  }

  function renderScreening() {
    var form = $("screeningForm");
    if (!form) return;
    clearHiddenAnswers();
    form.innerHTML = "";
    CFG.screening.forEach(function (q) {
      if (!isVisible(q)) return;
      var wrap = document.createElement("div");
      wrap.className = "q";
      var lab = document.createElement("label");
      lab.className = "qlabel";
      lab.textContent = q.label[LANG] || q.label.da;
      wrap.appendChild(lab);

      if (q.type === "number" || q.type === "text") {
        var inp = document.createElement("input");
        inp.type = q.type === "number" ? "number" : "text";
        if (q.min != null) inp.min = q.min;
        if (q.max != null) inp.max = q.max;
        if (answers[q.id] !== undefined) inp.value = answers[q.id];
        inp.addEventListener("input", function () {
          if (inp.value === "") { answers[q.id] = undefined; return; }
          answers[q.id] = q.type === "number" ? Number(inp.value) : inp.value;
        });
        wrap.appendChild(inp);
      } else if (q.type === "multichoice") {
        var mbox = document.createElement("div");
        mbox.className = "opts";
        var mlabels = q.options[LANG] || q.options.da;
        var selected = Array.isArray(answers[q.id]) ? answers[q.id] : [];
        mlabels.forEach(function (o, idx) {
          var el = document.createElement("div");
          var code = canonOf(q, idx);
          el.className = "opt" + (selected.indexOf(code) !== -1 ? " sel" : "");
          el.textContent = o;
          el.addEventListener("click", function () {
            var arr = Array.isArray(answers[q.id]) ? answers[q.id].slice() : [];
            var at = arr.indexOf(code);
            if (at === -1) arr.push(code); else arr.splice(at, 1);
            answers[q.id] = arr;
            renderScreening();   // re-render: reveals/hides the "Other" field, and any showIf-gated questions
          });
          mbox.appendChild(el);
        });
        wrap.appendChild(mbox);
        var otherInp;
        if (q.other) {
          otherInp = document.createElement("input");
          otherInp.type = "text";
          otherInp.placeholder = t("screening.otherPlaceholder");
          otherInp.style.display = selected.indexOf("other") !== -1 ? "" : "none";
          if (answers[q.id + "_other"] !== undefined) otherInp.value = answers[q.id + "_other"];
          otherInp.addEventListener("input", function () { answers[q.id + "_other"] = otherInp.value; });
          wrap.appendChild(otherInp);
        }
      } else {
        var box = document.createElement("div");
        box.className = q.type === "scale" ? "scale" : "opts";
        var labels = q.type === "yesno" ? yesnoLabels()
          : q.type === "scale" ? range(q.min, q.max)
            : (q.options[LANG] || q.options.da);
        var sel = selectedIndex(q);
        var oInp;
        labels.forEach(function (o, idx) {
          var el = document.createElement("div");
          el.className = "opt" + (idx === sel ? " sel" : "");
          el.textContent = o;
          el.addEventListener("click", function () {
            var code = q.type === "scale" ? Number(o) : canonOf(q, idx);
            answers[q.id] = code;
            renderScreening();   // re-render: reveals/hides the "Other" field, and any showIf-gated questions
          });
          box.appendChild(el);
        });
        wrap.appendChild(box);
        if (q.other) {
          oInp = document.createElement("input");
          oInp.type = "text";
          oInp.placeholder = t("screening.otherPlaceholder");
          oInp.style.display = answers[q.id] === "other" ? "" : "none";
          if (answers[q.id + "_other"] !== undefined) oInp.value = answers[q.id + "_other"];
          oInp.addEventListener("input", function () { answers[q.id + "_other"] = oInp.value; });
          wrap.appendChild(oInp);
        }
      }
      form.appendChild(wrap);
    });
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(String(i)); return r; }

  $("screeningNext").addEventListener("click", function () {
    var missing = CFG.screening.filter(function (q) {
      if (!isVisible(q)) return false;
      var v = answers[q.id];
      return q.required && (v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
    });
    if (missing.length) { $("screeningErr").textContent = t("screening.err"); return; }
    $("screeningErr").textContent = "";
    show("intro");
  });

  // ---- Pre-test -> countdown -> test -----------------------------------
  $("toCountdown").addEventListener("click", function () {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    show("countdown");
    var c = 3;
    $("count").textContent = c;
    var iv = setInterval(function () {
      c -= 1;
      if (c <= 0) { clearInterval(iv); startTest(); return; }
      $("count").textContent = c;
    }, 1000);
  });

  // ---- Draw a session --------------------------------------------------
  function parseSeq(s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) - 48); return a; }
  function drawSession() {
    var pool = []; for (var i = 1; i <= BANK.sequences.length; i++) pool.push(i);
    for (i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t2 = pool[i]; pool[i] = pool[j]; pool[j] = t2; }
    var picked = pool.slice(0, N_PER);
    var digits = [];
    picked.forEach(function (n) { digits = digits.concat(parseSeq(BANK.sequences[n - 1])); });
    return { drawn: picked, digits: digits };
  }

  // ---- Player + recorder ----------------------------------------------
  function startTest() {
    show("test");
    $("lang").style.display = "none";       // no toggle during the test
    var sess = drawSession();
    var digits = sess.digits;
    var epoch = performance.now();
    var startedWall = new Date().toISOString();
    var onsets = [{ index: 0, digit: digits[0], onset_ms: 0 }];
    var taps = [];
    var finished = false;
    var digitEl = $("digit");
    var btn = $("tapbtn");
    digitEl.textContent = digits[0];

    function tap() {
      if (finished) return;
      taps.push({ tap_ms: round2(performance.now() - epoch) });
      btn.classList.add("flash");
      setTimeout(function () { btn.classList.remove("flash"); }, 80);
    }
    function keyTap(e) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); tap(); } }
    btn.addEventListener("pointerdown", tap);
    window.addEventListener("keydown", keyTap);

    var i = 0;
    function finish() {
      if (finished) return;
      finished = true;
      btn.removeEventListener("pointerdown", tap);
      window.removeEventListener("keydown", keyTap);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      saveAndDone({
        drawn_sequences: sess.drawn,
        session_start_wallclock: startedWall,
        isi_ms: ISI,
        n_stimuli: digits.length,
        stimulus_stream: onsets,
        tap_events: taps,
        session_end_ms: round2(performance.now() - epoch),
      });
    }
    function step() {
      i += 1;
      if (i >= digits.length) { setTimeout(finish, ISI); return; }
      var target = epoch + i * ISI;
      var idx = i;
      setTimeout(function () {
        digitEl.textContent = digits[idx];
        onsets.push({ index: idx, digit: digits[idx], onset_ms: round2(performance.now() - epoch) });
        step();
      }, Math.max(0, target - performance.now()));
    }
    step();
  }

  // ---- Save (anonymous) ------------------------------------------------
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  // Personal-link support: an invitation link may carry ?p=<token> (or ?t=).
  // Present -> pseudonymous run; absent -> anonymous. Never a name/email.
  function participantToken() {
    try {
      var p = new URLSearchParams(location.search);
      var v = p.get("p") || p.get("t");
      return v ? String(v).slice(0, 64) : null;
    } catch (e) { return null; }
  }

  function saveAndDone(run) {
    var rec = {
      schema: "famse-web/1",
      bank_version: BANK.bank_version,
      anon_token: uuid(),
      identifier: identifier || null,          // study code typed at start (pseudonymous), else null
      participant_token: participantToken(),    // from a personal link (?p=), else null
      lang: LANG,
      device: { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: window.devicePixelRatio },
      sequences_per_session: N_PER,
      screening: answers,
      run: run,
    };
    var json = JSON.stringify(rec);
    function keepLocal() { try { localStorage.setItem("famse_" + rec.anon_token, json); } catch (e) {} }

    $("lang").style.display = "";
    show("done");
    $("doneMsg").textContent = t("done.msg");

    // The participant can NOT download their data. Send to the server; only if
    // that fails do we keep a local copy so it isn't lost (recoverable later).
    if (CFG.endpoint) {
      var headers = { "Content-Type": "application/json" };
      if (CFG.endpointToken) headers["Authorization"] = "Bearer " + CFG.endpointToken;
      fetch(CFG.endpoint, { method: "POST", headers: headers, body: json })
        .then(function (r) { if (!r.ok) throw new Error(); })
        .catch(function () { keepLocal(); $("doneMsg").textContent = t("done.msgLocal"); });
    } else {
      keepLocal();   // no endpoint configured -> local is the only sink
    }
  }

  applyLang();   // sets all text for the current language + renders screening
})();

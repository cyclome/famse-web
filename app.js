/* FAMSE web — flow, player, anonymous recording. No scoring on the client. */
(function () {
  "use strict";
  var BANK = window.FAMSE_BANK;
  var CFG = window.FAMSE_CONFIG;
  var ISI = BANK.isi_ms;
  var N_PER = CFG.sequencesPerSession || BANK.sequences_per_session;

  var answers = {};                 // screening answers
  var $ = function (id) { return document.getElementById(id); };
  var round2 = function (x) { return Math.round(x * 100) / 100; };

  function show(id) {
    var all = document.querySelectorAll(".screen");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
    $(id).classList.add("active");
  }

  // Generic "data-go" navigation.
  document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-go")); });
  });

  // ---- Screening -------------------------------------------------------
  function renderScreening() {
    var form = $("screeningForm");
    form.innerHTML = "";
    CFG.screening.forEach(function (q) {
      var wrap = document.createElement("div");
      wrap.className = "q";
      var lab = document.createElement("label");
      lab.className = "qlabel";
      lab.textContent = q.label;
      wrap.appendChild(lab);

      if (q.type === "number") {
        var inp = document.createElement("input");
        inp.type = "number";
        if (q.min != null) inp.min = q.min;
        if (q.max != null) inp.max = q.max;
        inp.addEventListener("input", function () {
          answers[q.id] = inp.value === "" ? undefined : Number(inp.value);
        });
        wrap.appendChild(inp);
      } else {
        var box = document.createElement("div");
        box.className = q.type === "scale" ? "scale" : "opts";
        var opts = q.type === "yesno" ? ["Ja", "Nej"]
          : q.type === "scale" ? range(q.min, q.max)
            : q.options;
        opts.forEach(function (o) {
          var el = document.createElement("div");
          el.className = "opt";
          el.textContent = o;
          el.addEventListener("click", function () {
            answers[q.id] = o;
            var sibs = box.querySelectorAll(".opt");
            for (var k = 0; k < sibs.length; k++) sibs[k].classList.remove("sel");
            el.classList.add("sel");
          });
          box.appendChild(el);
        });
        wrap.appendChild(box);
      }
      form.appendChild(wrap);
    });
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(String(i)); return r; }

  $("screeningNext").addEventListener("click", function () {
    var missing = CFG.screening.filter(function (q) {
      return q.required && (answers[q.id] === undefined || answers[q.id] === "");
    });
    if (missing.length) { $("screeningErr").textContent = "Besvar venligst alle spørgsmål."; return; }
    $("screeningErr").textContent = "";
    show("intro");
  });

  // ---- Pre-test -> countdown -> test -----------------------------------
  $("toCountdown").addEventListener("click", function () {
    // Fullscreen on this user gesture (best-effort).
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
    for (i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var picked = pool.slice(0, N_PER);
    var digits = [];
    picked.forEach(function (n) { digits = digits.concat(parseSeq(BANK.sequences[n - 1])); });
    return { drawn: picked, digits: digits };
  }

  // ---- Player + recorder ----------------------------------------------
  function startTest() {
    show("test");
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
        var t = performance.now() - epoch;
        digitEl.textContent = digits[idx];
        onsets.push({ index: idx, digit: digits[idx], onset_ms: round2(t) });
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
  function saveAndDone(run) {
    var rec = {
      schema: "famse-web/1",
      bank_version: BANK.bank_version,
      anon_token: uuid(),
      device: { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: window.devicePixelRatio },
      sequences_per_session: N_PER,
      screening: answers,
      run: run,
    };
    var json = JSON.stringify(rec);
    try { localStorage.setItem("famse_" + rec.anon_token, json); } catch (e) {}
    if (CFG.endpoint) {
      fetch(CFG.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: json })
        .then(function () { $("doneMsg").textContent = "Dine anonyme svar er gemt."; })
        .catch(function () { $("doneMsg").textContent = "Gemt lokalt (kunne ikke sende til server)."; });
    }
    var blob = new Blob([json], { type: "application/json" });
    $("downloadLink").href = URL.createObjectURL(blob);
    $("downloadLink").download = "famse_" + rec.anon_token + ".json";
    show("done");
  }

  renderScreening();
})();

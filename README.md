# FAMSE web

Anonymous, browser-based version of **FAMSE** (*Fluctuating Attention & working
Memory SEquence*) for quick pilots and student projects. Static site — no build
step, no login. Runs the real task (the validated 20-sequence bank, 600 ms
playback, tap recording) and collects a short screening questionnaire.

Live: **https://famse.cyclome.dk** (GitHub Pages).

## Anonymous by design

No name, no login, and the client cannot read the visitor's IP. Each run gets
a random `anon_token` only. An **optional** e-mail address may be collected
(screening question, `config.js`) solely to send a reminder to take the test
a second time — leave it blank to stay fully anonymous. Each run is saved
three ways:

1. **Download** — the participant can save their own JSON.
2. **localStorage** — a copy stays in the browser.
3. **POST** to `FAMSE_CONFIG.endpoint` — only if you set a URL in `config.js`
   (blank by default). Point it at an EU endpoint / Supabase for collection.

> Even anonymous, sleep/caffeine + performance data should be cleared with your
> data-governance/ethics before real recruitment, and any endpoint kept in the EU.

## Configure per project (`config.js`)

- `screening` — the questions (types: `number | choice | scale | yesno`).
- `sequencesPerSession` — sequences joined per run (4 ≈ 7 min; 2 ≈ 3.5 min).
- `endpoint` — anonymous POST target (blank = local only).

## Files

| File | What |
|---|---|
| `index.html` | Screen shell (landing → screening → intro → 2× Ja → 3-2-1 → test → done). |
| `styles.css` | Black-&-white UI; test = top-50% digit / bottom-50% TRYK. |
| `app.js` | Flow, drift-corrected 600 ms player, tap recorder, anonymous save. |
| `sequences.js` | The bundled 20-sequence bank (from `dawoe/tools/generator`). |
| `config.js` | Per-study screening + settings. |
| `CNAME` | `famse.cyclome.dk` for GitHub Pages. |

## Deploy

Push to `cyclome/famse-web`, then Settings → Pages → deploy from `main` / root.
DNS: add `CNAME famse → cyclome.github.io` for `cyclome.dk`.

/* FAMSE web — study configuration. Edit this file per project (agile).
   Bilingual: label/options carry {da, en}. Answers are stored language-
   INDEPENDENTLY (canonical value below), so switching DA/EN never changes data. */
window.FAMSE_CONFIG = {
  // How many of the 20 sequences to join for one run (each 175 digits, 600 ms).
  // 4 = ~7 min. Lower (e.g. 2 = ~3.5 min) for a shorter pilot.
  sequencesPerSession: 4,

  // Anonymous data sink. Leave "" to only download + localStorage. Set to the
  // EU-VPS receiver URL to also POST the JSON. No PII is collected.
  endpoint: "https://api.famse.cyclome.dk/famse",                 // e.g. "https://api.famse.cyclome.dk/famse"
  endpointToken: "8e7775b91ce492be7a7eb1c2abb2f1d4455e3b4040626291",            // must match the server's FAMSE_TOKEN (light deterrent only)

  // Optional identifier entered at the start (before the questions). Stored as
  // `identifier` in the record. Enabling this makes runs PSEUDONYMOUS (the code
  // can link to a person via your invitation list) — it is a study code, not a
  // name. Set enabled:false for a fully anonymous open link.
  identifier: {
    enabled: true,
    required: true,
    label: { da: "Indtast din deltager-kode", en: "Enter your participant code" },
    help: {
      da: "Koden står i din invitation. Skriv ikke dit navn.",
      en: "The code is in your invitation. Do not enter your name.",
    },
  },

  // Screening questions — shown before the test, stored with the run.
  // types: number | choice | scale | yesno
  // Stored value: number -> the number; scale -> the number; yesno -> "yes"/"no";
  // choice -> the `values[i]` code (falls back to the English option if omitted).
  screening: [
    {
      id: "age", type: "number",
      label: { da: "Alder (år)", en: "Age (years)" },
      min: 18, max: 120, required: true,
    },
    {
      id: "gender", type: "choice",
      label: { da: "Køn", en: "Gender" },
      options: {
        da: ["Kvinde", "Mand", "Andet", "Vil ikke oplyse"],
        en: ["Female", "Male", "Other", "Prefer not to say"],
      },
      values: ["female", "male", "other", "undisclosed"],
      required: true,
    },
    {
      id: "sleep_1_10", type: "scale",
      label: {
        da: "På en skala fra 1–10 (10 = perfekt): hvor godt sov du i nat?",
        en: "On a scale of 1–10 (10 = perfect): how well did you sleep last night?",
      },
      min: 1, max: 10, required: true,
    },
    {
      id: "nicotine_2h", type: "yesno",
      label: {
        da: "Inden for de sidste to timer — har du røget eller brugt nikotinprodukter?",
        en: "In the last two hours — have you smoked or used nicotine products?",
      },
      required: true,
    },
    {
      id: "caffeine_2h", type: "yesno",
      label: {
        da: "Inden for de sidste to timer — har du indtaget koffeinholdige drikke (kaffe, sort te, energidrik)?",
        en: "In the last two hours — have you consumed caffeinated drinks (coffee, black tea, energy drinks)?",
      },
      required: true,
    },
  ],
};

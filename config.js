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
  // types: number | text | choice | multichoice | scale | yesno
  // Stored value: number -> the number; text -> the string; scale -> the
  // number; yesno -> "yes"/"no"; choice -> the `values[i]` code (falls back
  // to the English option if omitted); multichoice -> array of codes.
  // choice/multichoice: set `other: true` to make the LAST option an
  // "Other" free-text field, stored under `<id>_other`.
  // showIf: { id, equals } — only shown (and only required) when the
  // referenced question's current answer equals that value.
  screening: [
    {
      id: "age", type: "number",
      label: { da: "Alder (år)", en: "Age (years)" },
      min: 18, max: 120, required: true,
    },
    {
      // Optional -- see README "Anonymous by design". Left blank, the run
      // stays fully anonymous; filled in, it's stored with the run so
      // server/send_reminders.py can send the reminder (2h later, per
      // server/DEPLOY.md §7) -- and scrubs the email once sent.
      id: "email", type: "text",
      label: {
        da: "E-mail (valgfri) — du får en påmindelse om at tage testen igen 30 minutter til 2 timer efter du har indtaget en koffeinholdig eller koffeinfri drik",
        en: "Email (optional) — you'll be sent a reminder to take the test again 30 minutes to 2 hours after consuming a caffeinated or decaffeinated beverage",
      },
      required: false,
    },
    {
      id: "beverage_recent", type: "yesno",
      label: {
        da: "Har du indtaget andet end vand inden for de sidste 30 minutter til 2 timer?",
        en: "Have you consumed a beverage other than water within the last 30 minutes to 2 hours?",
      },
      required: true,
    },
    {
      id: "beverage_types", type: "multichoice", other: true,
      showIf: { id: "beverage_recent", equals: "yes" },
      label: {
        da: "Hvilke af følgende drikke? (Vælg én eller flere)",
        en: "Which of the following beverages? (Choose one or more)",
      },
      options: {
        da: ["Koffeinholdig kaffe", "Koffeinfri kaffe", "Energidrik", "Koffeinholdig sort te",
          "Koffeinfri sort te", "Juice", "Matcha", "Koffeinholdig sodavand", "Koffeinfri sodavand",
          "Alkoholisk drik", "Andet"],
        en: ["Caffeinated coffee", "Decaffeinated coffee", "Energy drink", "Caffeinated black tea",
          "Decaffeinated black tea", "Juice", "Matcha", "Caffeinated soda", "Decaffeinated soda",
          "Alcoholic beverage", "Other"],
      },
      values: ["caff_coffee", "decaf_coffee", "energy_drink", "caff_black_tea", "decaf_black_tea",
        "juice", "matcha", "caff_soda", "decaf_soda", "alcohol", "other"],
      required: true,
    },
    {
      id: "beverage_servings", type: "text",
      showIf: { id: "beverage_recent", equals: "yes" },
      label: { da: "Hvor mange portioner?", en: "How many serving sizes?" },
      required: true,
    },
    {
      id: "gender", type: "choice", other: true,
      label: { da: "Hvad er dit køn?", en: "What is your gender?" },
      options: {
        da: ["Mand", "Kvinde", "Ikke-binær", "Andet"],
        en: ["Male", "Female", "Nonbinary", "Other"],
      },
      values: ["male", "female", "nonbinary", "other"],
      required: true,
    },
    {
      id: "sleep_last_night", type: "scale",
      label: {
        da: "På en skala fra 0–10 (0 = ekstremt dårligt, 10 = fremragende): hvordan vil du vurdere din søvn i nat?",
        en: "On a scale of 0–10 (0 is extremely poor and 10 is excellent): how would you rate your sleep last night?",
      },
      min: 0, max: 10, required: true,
    },
    {
      id: "sleep_last_year", type: "scale",
      label: {
        da: "På en skala fra 0–10 (0 = ekstremt dårligt, 10 = fremragende): hvordan vil du vurdere din søvn over det seneste år?",
        en: "On a scale of 0–10 (0 is extremely poor and 10 is excellent): how would you rate your sleep over the last year?",
      },
      min: 0, max: 10, required: true,
    },
    {
      id: "exercise_recent", type: "yesno",
      label: {
        da: "Har du trænet inden for de sidste 30 minutter til 2 timer?",
        en: "Have you exercised in the last 30 minutes to 2 hours?",
      },
      required: true,
    },
    {
      id: "exercise_detail", type: "text",
      showIf: { id: "exercise_recent", equals: "yes" },
      label: {
        da: "Beskriv venligst typen og intensiteten af træningen",
        en: "Please describe the type and intensity of exercise",
      },
      required: true,
    },
    {
      id: "substances_24h", type: "yesno",
      label: {
        da: "Har du indtaget stoffer eller alkohol inden for de sidste 24 timer?",
        en: "Have you consumed drugs or alcohol in the last 24 hours?",
      },
      required: true,
    },
    {
      id: "substances_types", type: "multichoice", other: true,
      showIf: { id: "substances_24h", equals: "yes" },
      label: { da: "Hvilke stoffer?", en: "If so, which one(s)?" },
      options: {
        da: ["Alkohol", "Marihuana", "Nikotin", "Tobak", "Stimulanser", "Dæmpende midler", "Andet"],
        en: ["Alcohol", "Marijuana", "Nicotine", "Tobacco", "Stimulants", "Depressants", "Other"],
      },
      values: ["alcohol", "marijuana", "nicotine", "tobacco", "stimulants", "depressants", "other"],
      required: true,
    },
  ],
};

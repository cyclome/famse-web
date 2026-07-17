/* FAMSE web — study configuration. Edit this file per project (agile). */
window.FAMSE_CONFIG = {
  // How many of the 20 sequences to join for one run (each 175 digits, 600 ms).
  // 4 = ~7 min. Lower (e.g. 2 = ~3.5 min) for a shorter pilot.
  sequencesPerSession: 4,

  // Anonymous data sink. Leave "" to only download + localStorage. Set to a URL
  // (your EU endpoint / Supabase REST) to also POST the JSON. No PII is collected.
  endpoint: "",

  // Screening questions — shown before the test, stored with the run.
  // types: number | choice | scale | yesno
  screening: [
    { id: "age", type: "number", label: "Alder (år)", min: 18, max: 120, required: true },
    {
      id: "gender", type: "choice", label: "Køn",
      options: ["Kvinde", "Mand", "Andet", "Vil ikke oplyse"], required: true,
    },
    {
      id: "sleep_1_10", type: "scale",
      label: "På en skala fra 1–10 (10 = perfekt): hvor godt sov du i nat?",
      min: 1, max: 10, required: true,
    },
    {
      id: "nicotine_2h", type: "yesno",
      label: "Inden for de sidste to timer — har du røget eller brugt nikotinprodukter?",
      required: true,
    },
    {
      id: "caffeine_2h", type: "yesno",
      label: "Inden for de sidste to timer — har du indtaget koffeinholdige drikke (kaffe, sort te, energidrik)?",
      required: true,
    },
  ],
};

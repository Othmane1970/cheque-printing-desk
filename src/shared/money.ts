// Currencies, amounts in minor units, and the amount written out in words.

export type Language = "en" | "fr" | "ar";
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
];

interface Names {
  one: string;
  many: string;
}
interface Currency {
  code: string;
  decimals: number;
  en: [Names, Names];
  fr: [Names, Names];
  ar: [string, string];
}

const n = (one: string, many = one): Names => ({ one, many });

const CURRENCIES: Currency[] = [
  {
    code: "AED",
    decimals: 2,
    en: [n("UAE dirham", "UAE dirhams"), n("fil", "fils")],
    fr: [n("dirham émirati", "dirhams émiratis"), n("fils")],
    ar: ["درهم إماراتي", "فلس"],
  },
  {
    code: "SAR",
    decimals: 2,
    en: [n("Saudi riyal", "Saudi riyals"), n("halala", "halalas")],
    fr: [n("riyal saoudien", "riyals saoudiens"), n("halala", "halalas")],
    ar: ["ريال سعودي", "هللة"],
  },
  {
    code: "QAR",
    decimals: 2,
    en: [n("Qatari riyal", "Qatari riyals"), n("dirham", "dirhams")],
    fr: [n("riyal qatari", "riyals qataris"), n("dirham", "dirhams")],
    ar: ["ريال قطري", "درهم"],
  },
  {
    code: "KWD",
    decimals: 3,
    en: [n("Kuwaiti dinar", "Kuwaiti dinars"), n("fils")],
    fr: [n("dinar koweïtien", "dinars koweïtiens"), n("fils")],
    ar: ["دينار كويتي", "فلس"],
  },
  {
    code: "BHD",
    decimals: 3,
    en: [n("Bahraini dinar", "Bahraini dinars"), n("fils")],
    fr: [n("dinar bahreïni", "dinars bahreïnis"), n("fils")],
    ar: ["دينار بحريني", "فلس"],
  },
  {
    code: "OMR",
    decimals: 3,
    en: [n("Omani rial", "Omani rials"), n("baisa", "baisas")],
    fr: [n("rial omanais", "rials omanais"), n("baïsa", "baïsas")],
    ar: ["ريال عماني", "بيسة"],
  },
  {
    code: "DZD",
    decimals: 2,
    en: [n("Algerian dinar", "Algerian dinars"), n("centime", "centimes")],
    fr: [n("dinar algérien", "dinars algériens"), n("centime", "centimes")],
    ar: ["دينار جزائري", "سنتيم"],
  },
  {
    code: "MAD",
    decimals: 2,
    en: [n("Moroccan dirham", "Moroccan dirhams"), n("centime", "centimes")],
    fr: [n("dirham marocain", "dirhams marocains"), n("centime", "centimes")],
    ar: ["درهم مغربي", "سنتيم"],
  },
  {
    code: "TND",
    decimals: 3,
    en: [n("Tunisian dinar", "Tunisian dinars"), n("millime", "millimes")],
    fr: [n("dinar tunisien", "dinars tunisiens"), n("millime", "millimes")],
    ar: ["دينار تونسي", "مليم"],
  },
  {
    code: "EGP",
    decimals: 2,
    en: [n("Egyptian pound", "Egyptian pounds"), n("piastre", "piastres")],
    fr: [n("livre égyptienne", "livres égyptiennes"), n("piastre", "piastres")],
    ar: ["جنيه مصري", "قرش"],
  },
  {
    code: "USD",
    decimals: 2,
    en: [n("US dollar", "US dollars"), n("cent", "cents")],
    fr: [n("dollar américain", "dollars américains"), n("cent", "cents")],
    ar: ["دولار أمريكي", "سنت"],
  },
  {
    code: "EUR",
    decimals: 2,
    en: [n("euro", "euros"), n("cent", "cents")],
    fr: [n("euro", "euros"), n("centime", "centimes")],
    ar: ["يورو", "سنت"],
  },
  {
    code: "GBP",
    decimals: 2,
    en: [n("pound sterling", "pounds sterling"), n("penny", "pence")],
    fr: [n("livre sterling", "livres sterling"), n("penny", "pence")],
    ar: ["جنيه إسترليني", "بنس"],
  },
];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [
  string,
  ...string[],
];

function currency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;
}

/** "1,234.5" as minor units (123450 for two decimals), or null when it isn't an amount. */
export function parseAmount(input: string, code: string): number | null {
  const { decimals } = currency(code);
  const clean = input.replace(/[,\s]/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(clean);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  const minor =
    Number(match[1]) * 10 ** decimals +
    Number(fraction.padEnd(decimals, "0") || 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** The amount as typed into the form: no grouping, trailing zeros dropped. */
export function amountInput(minor: number, code: string): string {
  const { decimals } = currency(code);
  const major = Math.floor(minor / 10 ** decimals);
  const frac = String(minor % 10 ** decimals)
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return frac ? `${major}.${frac}` : String(major);
}

export function formatAmount(minor: number, code: string): string {
  const { decimals } = currency(code);
  return (minor / 10 ** decimals).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const MAX_MINOR = 999_999_999_999;

export function amountInWords(
  minor: number,
  code: string,
  language: Language,
): string {
  const c = currency(code);
  const scale = 10 ** c.decimals;
  const major = Math.floor(minor / scale);
  const fraction = minor % scale;
  if (language === "ar") return arabic(major, fraction, c);
  const names = c[language];
  const words = language === "en" ? english : french;
  const parts: string[] = [];
  if (major > 0 || fraction === 0) {
    const w = words(major);
    const de =
      language === "fr" && major >= 1_000_000 && major % 1_000_000 === 0
        ? "de "
        : "";
    parts.push(`${w} ${de}${major === 1 ? names[0].one : names[0].many}`);
  }
  if (fraction > 0) {
    parts.push(
      `${words(fraction)} ${fraction === 1 ? names[1].one : names[1].many}`,
    );
  }
  const joined = parts.join(language === "en" ? " and " : " et ");
  const text = `${joined} ${language === "en" ? "only" : "seulement"}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const SCALES = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
] as const;

const EN_UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function english(value: number): string {
  if (value === 0) return "zero";
  const out: string[] = [];
  let rest = value;
  for (const [size, name] of SCALES) {
    if (rest >= size) {
      out.push(`${englishBelow1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) out.push(englishBelow1000(rest));
  return out.join(" ");
}

function englishBelow1000(value: number): string {
  const out: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) out.push(`${EN_UNITS[hundreds]} hundred`);
  if (rest >= 20) {
    const unit = rest % 10;
    out.push(
      unit
        ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_UNITS[unit]}`
        : EN_TENS[Math.floor(rest / 10)]!,
    );
  } else if (rest > 0) out.push(EN_UNITS[rest]!);
  return out.join(" ");
}

const FR_UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const FR_TENS = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
];

function french(value: number): string {
  if (value === 0) return "zéro";
  const out: string[] = [];
  let rest = value;
  for (const [size, name] of SCALES) {
    const count = Math.floor(rest / size);
    rest %= size;
    if (!count) continue;
    if (name === "thousand") {
      // "mille" never takes "un" and never agrees; what comes before it stays invariable.
      out.push(
        count === 1 ? "mille" : `${frenchBelow1000(count, false)} mille`,
      );
    } else {
      const noun = name === "million" ? "million" : "milliard";
      out.push(
        `${frenchBelow1000(count, true)} ${noun}${count > 1 ? "s" : ""}`,
      );
    }
  }
  if (rest > 0) out.push(frenchBelow1000(rest, true));
  return out.join(" ");
}

/** `agree`: "cents" and "quatre-vingts" take their s when nothing follows. */
function frenchBelow1000(value: number, agree: boolean): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const out: string[] = [];
  if (hundreds === 1) out.push("cent");
  else if (hundreds > 1)
    out.push(`${FR_UNITS[hundreds]} cent${rest === 0 && agree ? "s" : ""}`);
  if (rest > 0) out.push(frenchBelow100(rest, agree));
  return out.join(" ");
}

function frenchBelow100(value: number, agree: boolean): string {
  if (value < 20) return FR_UNITS[value]!;
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  if (tens === 7 || tens === 9) {
    const base = tens === 7 ? "soixante" : "quatre-vingt";
    const sub = FR_UNITS[10 + unit]!;
    return tens === 7 && unit === 1 ? "soixante et onze" : `${base}-${sub}`;
  }
  if (tens === 8)
    return unit === 0
      ? `quatre-vingt${agree ? "s" : ""}`
      : `quatre-vingt-${FR_UNITS[unit]}`;
  if (unit === 0) return FR_TENS[tens]!;
  if (unit === 1) return `${FR_TENS[tens]} et un`;
  return `${FR_TENS[tens]}-${FR_UNITS[unit]}`;
}

const AR_UNITS = [
  "صفر",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
];
const AR_TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];
const AR_HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];
const AR_SCALES: [number, string, string, string][] = [
  [1_000_000_000, "مليار", "ملياران", "مليارات"],
  [1_000_000, "مليون", "مليونان", "ملايين"],
  [1_000, "ألف", "ألفان", "آلاف"],
];

function arabicNumber(value: number): string {
  if (value === 0) return AR_UNITS[0]!;
  const out: string[] = [];
  let rest = value;
  for (const [size, one, two, few] of AR_SCALES) {
    const count = Math.floor(rest / size);
    rest %= size;
    if (!count) continue;
    if (count === 1) out.push(one);
    else if (count === 2) out.push(two);
    else if (count <= 10) out.push(`${AR_UNITS[count]} ${few}`);
    else out.push(`${arabicBelow1000(count)} ${one}`);
  }
  if (rest > 0) out.push(arabicBelow1000(rest));
  return out.join(" و");
}

function arabicBelow1000(value: number): string {
  const out: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) out.push(AR_HUNDREDS[hundreds]!);
  if (rest > 0 && rest <= 10) out.push(AR_UNITS[rest]!);
  else if (rest === 11) out.push("أحد عشر");
  else if (rest === 12) out.push("اثنا عشر");
  else if (rest > 12 && rest < 20) out.push(`${AR_UNITS[rest - 10]} عشر`);
  else if (rest >= 20) {
    const unit = rest % 10;
    const tens = AR_TENS[Math.floor(rest / 10)]!;
    out.push(unit ? `${AR_UNITS[unit]} و${tens}` : tens);
  }
  return out.join(" و");
}

function arabic(major: number, fraction: number, c: Currency): string {
  const parts: string[] = [];
  if (major > 0 || fraction === 0)
    parts.push(`${arabicNumber(major)} ${c.ar[0]}`);
  if (fraction > 0) parts.push(`${arabicNumber(fraction)} ${c.ar[1]}`);
  return `فقط ${parts.join(" و")} لا غير`;
}

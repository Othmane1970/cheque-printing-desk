import { describe, expect, it } from "vitest";
import { amountInWords, formatAmount, parseAmount } from "./money";

describe("amount in words", () => {
  it("writes English with fractional units and 'only'", () => {
    expect(amountInWords(1250075, "AED", "en")).toBe(
      "Twelve thousand five hundred UAE dirhams and seventy-five fils only",
    );
    expect(amountInWords(100, "USD", "en")).toBe("One US dollar only");
    expect(amountInWords(50, "USD", "en")).toBe("Fifty cents only");
    expect(amountInWords(1_000_001_000, "KWD", "en")).toBe(
      "One million one Kuwaiti dinars only",
    );
  });
  it("writes French with its agreement rules", () => {
    expect(amountInWords(1250075, "AED", "fr")).toBe(
      "Douze mille cinq cents dirhams émiratis et soixante-quinze fils seulement",
    );
    expect(amountInWords(8000, "DZD", "fr")).toBe(
      "Quatre-vingts dinars algériens seulement",
    );
    expect(amountInWords(7100, "DZD", "fr")).toBe(
      "Soixante et onze dinars algériens seulement",
    );
    expect(amountInWords(20000000, "DZD", "fr")).toBe(
      "Deux cent mille dinars algériens seulement",
    );
    expect(amountInWords(200000000, "DZD", "fr")).toBe(
      "Deux millions de dinars algériens seulement",
    );
  });
  it("writes Arabic between فقط and لا غير", () => {
    expect(amountInWords(250050, "SAR", "ar")).toBe(
      "فقط ألفان وخمسمائة ريال سعودي وخمسون هللة لا غير",
    );
    expect(amountInWords(2100, "AED", "ar")).toBe(
      "فقط واحد وعشرون درهم إماراتي لا غير",
    );
  });
});

describe("amounts", () => {
  it("parses into minor units for the currency", () => {
    expect(parseAmount("12,500.75", "AED")).toBe(1250075);
    expect(parseAmount("1.234", "KWD")).toBe(1234);
    expect(parseAmount("1.234", "AED")).toBeNull();
    expect(parseAmount("abc", "AED")).toBeNull();
    expect(formatAmount(1250075, "AED")).toBe("12,500.75");
  });
});

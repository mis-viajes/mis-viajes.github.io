import { describe, expect, it } from "vitest";
import { convertMinor, formatMoney, parseAmount, splitEvenly } from "../money";

describe("parseAmount", () => {
  it("interpreta formatos habituales", () => {
    expect(parseAmount("1.234,56", "EUR")).toBe(123456);
    expect(parseAmount("1,234.56", "USD")).toBe(123456);
    expect(parseAmount("89,90", "EUR")).toBe(8990);
    expect(parseAmount("89.9", "EUR")).toBe(8990);
    expect(parseAmount("45.000", "CLP")).toBe(45000);
    expect(parseAmount("1.250.000", "CLP")).toBe(1250000);
    expect(parseAmount("$ 950.000", "CLP")).toBe(950000);
    expect(parseAmount(123.45, "EUR")).toBe(12345);
  });
  it("rechaza valores no numéricos", () => {
    expect(parseAmount("abc", "EUR")).toBeNull();
    expect(parseAmount("", "EUR")).toBeNull();
  });
});

describe("convertMinor", () => {
  it("convierte respetando los decimales de cada moneda", () => {
    expect(convertMinor(8990, "EUR", "CLP", 1000)).toBe(89900);
    expect(convertMinor(100000, "CLP", "EUR", 0.001)).toBe(10000);
    expect(convertMinor(5000, "CLP", "CLP", 999)).toBe(5000);
  });
});

describe("splitEvenly", () => {
  it("no pierde unidades al repartir", () => {
    const parts = splitEvenly(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe("formatMoney", () => {
  it("formatea CLP sin decimales", () => {
    expect(formatMoney(950000, "CLP")).toMatch(/950\.000/);
  });
});

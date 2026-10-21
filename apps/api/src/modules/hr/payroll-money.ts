export type FinancialRounding = "nearest_centavo" | "up_centavo" | "down_centavo";

// Integer centavos and basis points stay exact through multiplication and division.
export function financialRatio(
  amount: number,
  numerator: number,
  denominator: number,
  rounding: FinancialRounding = "nearest_centavo",
) {
  if (![amount, numerator, denominator].every(Number.isSafeInteger) || denominator <= 0)
    throw new Error("Invalid financial input");
  const value = BigInt(amount) * BigInt(numerator),
    divisor = BigInt(denominator);
  const sign = value < 0n ? -1n : 1n,
    magnitude = value * sign;
  const offset =
    rounding === "up_centavo" ? divisor - 1n : rounding === "down_centavo" ? 0n : divisor / 2n;
  const result = Number(sign * ((magnitude + offset) / divisor));
  if (!Number.isSafeInteger(result)) throw new Error("Financial result overflow");
  return result;
}

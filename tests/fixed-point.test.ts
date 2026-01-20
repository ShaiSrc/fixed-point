import {
  createFixedPoint,
  fp as defaultFp,
  FixedPointOps,
} from "../src/fixed-point";
import {
  createFixedPoint as createFromIndex,
  fp as fpFromIndex,
} from "../src/index";

describe("fixed-point factory defaults", () => {
  test("default factory is 16.16 and 32-bit", () => {
    expect(defaultFp.FRACTION_BITS).toBe(16);
    expect(defaultFp.TOTAL_BITS).toBe(32);
    expect(defaultFp.SHIFT).toBe(16);
  });

  test("index exports mirror fixed-point exports", () => {
    const fp = createFromIndex() as FixedPointOps<number>;
    expect(fpFromIndex.FRACTION_BITS).toBe(16);
    expect(fp.FRACTION_BITS).toBe(16);
  });
});

describe("validation", () => {
  test("rejects non-integer config", () => {
    expect(() =>
      createFixedPoint({ fractionBits: 16.5, totalBits: 32 }),
    ).toThrow("Fixed-point config must use integer bit sizes.");
  });

  test("rejects fractionBits <= 0", () => {
    expect(() => createFixedPoint({ fractionBits: 0, totalBits: 32 })).toThrow(
      "fractionBits must be > 0.",
    );
  });

  test("rejects totalBits <= fractionBits", () => {
    expect(() => createFixedPoint({ fractionBits: 16, totalBits: 16 })).toThrow(
      "totalBits must be greater than fractionBits.",
    );
  });

  test("rejects useBigInt=false when totalBits > 32", () => {
    expect(() =>
      createFixedPoint({
        fractionBits: 16,
        totalBits: 64,
        useBigInt: false,
      }),
    ).toThrow("useBigInt=false is not supported for totalBits > 32.");
  });
});

describe("number fixed-point ops", () => {
  const fp32 = createFixedPoint({
    fractionBits: 16,
    totalBits: 32,
  }) as FixedPointOps<number>;
  const fp24 = createFixedPoint({
    fractionBits: 8,
    totalBits: 24,
  }) as FixedPointOps<number>;
  const fp14 = createFixedPoint({
    fractionBits: 14,
    totalBits: 32,
  }) as FixedPointOps<number>;
  const fp18 = createFixedPoint({
    fractionBits: 18,
    totalBits: 32,
  }) as FixedPointOps<number>;

  test("fromInt/fromFloat/toFloat/toInt", () => {
    const five = fp32.fromInt(5);
    expect(fp32.toFloat(five)).toBe(5);
    expect(fp32.toInt(five)).toBe(5);

    const half = fp32.fromFloat(0.5);
    expect(fp32.toFloat(half)).toBeCloseTo(0.5, 5);
    expect(fp32.toInt(half)).toBe(0);

    const neg = fp32.fromFloat(-2.25);
    expect(fp32.toInt(neg)).toBe(-2);
  });

  test("fromString", () => {
    const val = fp32.fromString("1.5");
    expect(fp32.toFloat(val)).toBeCloseTo(1.5, 5);

    const plus = fp32.fromString("+2.5");
    expect(fp32.toFloat(plus)).toBeCloseTo(2.5, 5);

    const rounded = fp32.fromString("0.1");
    expect(rounded).toBe(fp32.fromFloat(0.1));

    const neg = fp32.fromString("-2.25");
    expect(neg).toBe(fp32.fromFloat(-2.25));

    expect(() => fp32.fromString("")).toThrow("Fixed-point string is empty.");
    expect(() => fp32.fromString("1.2.3")).toThrow(
      "Invalid fixed-point string.",
    );
    expect(() => fp32.fromString(".")).toThrow("Invalid fixed-point string.");
    expect(() => fp32.fromString("abc")).toThrow("Invalid fixed-point string.");
    expect(() => fp32.fromString(123 as unknown as string)).toThrow(
      "Fixed-point string must be a string.",
    );
  });

  test("add/sub/negate/abs", () => {
    const a = fp32.fromFloat(1.25);
    const b = fp32.fromFloat(0.75);
    const pos = fp32.fromInt(2);

    expect(fp32.toFloat(fp32.add(a, b))).toBeCloseTo(2.0, 5);
    expect(fp32.toFloat(fp32.sub(a, b))).toBeCloseTo(0.5, 5);
    expect(fp32.toFloat(fp32.negate(a))).toBeCloseTo(-1.25, 5);
    expect(fp32.toFloat(fp32.abs(fp32.negate(a)))).toBeCloseTo(1.25, 5);
    expect(fp32.abs(pos)).toBe(pos);
  });

  test("mul/div/mod with errors", () => {
    const a = fp32.fromFloat(2.5);
    const b = fp32.fromFloat(1.25);

    expect(fp32.toFloat(fp32.mul(a, b))).toBeCloseTo(3.125, 5);
    expect(fp32.toFloat(fp32.div(a, b))).toBeCloseTo(2.0, 5);

    const mod = fp32.mod(fp32.fromInt(7), fp32.fromInt(3));
    expect(fp32.toInt(mod)).toBe(1);

    expect(() => fp32.div(a, 0)).toThrow(
      "Division by zero in fixed-point arithmetic",
    );
    expect(() => fp32.mod(a, 0)).toThrow(
      "Division by zero in fixed-point arithmetic",
    );
  });

  test("rejects non-integer fixed-point inputs", () => {
    expect(() => fp32.add(1.1, fp32.ONE)).toThrow("fixed-point value");
    expect(() => fp32.sin(fp32.fromFloat(1.5) + 0.5)).toThrow(
      "fixed-point value",
    );
    expect(() => fp32.fromFloat(Number.NaN)).toThrow(
      "Fixed-point values must be finite integers.",
    );
  });

  test("sqrt", () => {
    const four = fp32.fromInt(4);
    const two = fp32.sqrt(four);
    const zero = fp32.fromInt(0);
    expect(fp32.toFloat(two)).toBeCloseTo(2, 5);
    expect(fp32.toFloat(fp32.sqrt(zero))).toBe(0);
    expect(() => fp32.sqrt(fp32.fromInt(-1))).toThrow(
      "Sqrt of negative number",
    );
  });

  test("sin/cos", () => {
    const halfPi = fp32.fromFloat(Math.PI / 2);
    const zero = fp32.fromFloat(0);
    const negHalfPi = fp32.fromFloat(-Math.PI / 2);

    expect(fp32.toFloat(fp32.sin(halfPi))).toBeCloseTo(1, 3);
    expect(fp32.toFloat(fp32.cos(halfPi))).toBeCloseTo(0, 3);
    expect(fp32.toFloat(fp32.sin(zero))).toBeCloseTo(0, 6);
    expect(fp32.toFloat(fp32.sin(negHalfPi))).toBeCloseTo(-1, 3);
  });

  test("comparisons", () => {
    const a = fp32.fromInt(2);
    const b = fp32.fromInt(3);

    expect(fp32.eq(a, a)).toBe(true);
    expect(fp32.neq(a, b)).toBe(true);
    expect(fp32.gt(b, a)).toBe(true);
    expect(fp32.gte(a, a)).toBe(true);
    expect(fp32.lt(a, b)).toBe(true);
    expect(fp32.lte(a, b)).toBe(true);
  });

  test("non-32-bit wrap", () => {
    const max = fp24.MAX;
    const min = fp24.MIN;

    const wrapped = fp24.add(max, 1);
    expect(wrapped).toBe(min);
  });

  test("scaleQ16 diff branches (number)", () => {
    expect(fp14.ONE).toBe(2 ** 14);
    expect(fp18.ONE).toBe(2 ** 18);
  });

  test("number LUT cache reuse", () => {
    const fpA = createFixedPoint({ fractionBits: 16, totalBits: 32 });
    const fpB = createFixedPoint({ fractionBits: 16, totalBits: 32 });
    expect(fpA.sin(fpA.fromInt(0))).toBe(fpB.sin(fpB.fromInt(0)));
  });
});

describe("bigint fixed-point ops", () => {
  const fp64 = createFixedPoint({
    fractionBits: 16,
    totalBits: 64,
    useBigInt: true,
  }) as FixedPointOps<bigint>;
  const fp48 = createFixedPoint({
    fractionBits: 18,
    totalBits: 48,
    useBigInt: true,
  }) as FixedPointOps<bigint>;
  const fp32 = createFixedPoint({
    fractionBits: 14,
    totalBits: 40,
    useBigInt: true,
  }) as FixedPointOps<bigint>;

  test("fromInt/fromFloat/toFloat/toInt", () => {
    const five = fp64.fromInt(5);
    expect(fp64.toFloat(five)).toBe(5);
    expect(fp64.toInt(five)).toBe(5n);

    const half = fp64.fromFloat(0.5);
    expect(fp64.toFloat(half)).toBeCloseTo(0.5, 5);
    expect(fp64.toInt(half)).toBe(0n);

    const neg = fp64.fromFloat(-2.25);
    expect(fp64.toInt(neg)).toBe(-2n);
  });

  test("fromString", () => {
    const val = fp64.fromString("1.5");
    expect(fp64.toFloat(val)).toBeCloseTo(1.5, 5);

    const rounded = fp64.fromString("0.1");
    expect(rounded).toBe(fp64.fromFloat(0.1));

    const neg = fp64.fromString("-2.25");
    expect(neg).toBe(fp64.fromFloat(-2.25));

    expect(() => fp64.fromString("")).toThrow("Fixed-point string is empty.");
    expect(() => fp64.fromString("1.2.3")).toThrow(
      "Invalid fixed-point string.",
    );
    expect(() => fp64.fromString("abc")).toThrow("Invalid fixed-point string.");
  });

  test("add/sub/negate/abs", () => {
    const a = fp64.fromFloat(1.25);
    const b = fp64.fromFloat(0.75);
    const pos = fp64.fromInt(2);

    expect(fp64.toFloat(fp64.add(a, b))).toBeCloseTo(2.0, 5);
    expect(fp64.toFloat(fp64.sub(a, b))).toBeCloseTo(0.5, 5);
    expect(fp64.toFloat(fp64.negate(a))).toBeCloseTo(-1.25, 5);
    expect(fp64.toFloat(fp64.abs(fp64.negate(a)))).toBeCloseTo(1.25, 5);
    expect(fp64.abs(pos)).toBe(pos);
  });

  test("mul/div/mod with errors", () => {
    const a = fp64.fromFloat(2.5);
    const b = fp64.fromFloat(1.25);

    expect(fp64.toFloat(fp64.mul(a, b))).toBeCloseTo(3.125, 5);
    expect(fp64.toFloat(fp64.div(a, b))).toBeCloseTo(2.0, 5);

    const mod = fp64.mod(fp64.fromInt(7), fp64.fromInt(3));
    expect(fp64.toInt(mod)).toBe(1n);

    expect(() => fp64.div(a, 0n)).toThrow(
      "Division by zero in fixed-point arithmetic",
    );
    expect(() => fp64.mod(a, 0n)).toThrow(
      "Division by zero in fixed-point arithmetic",
    );
  });

  test("sqrt", () => {
    const four = fp64.fromInt(4);
    const two = fp64.sqrt(four);
    expect(fp64.toFloat(two)).toBeCloseTo(2, 5);
    expect(() => fp64.sqrt(fp64.fromInt(-1))).toThrow(
      "Sqrt of negative number",
    );
  });

  test("sin/cos", () => {
    const halfPi = fp64.fromFloat(Math.PI / 2);
    const zero = fp64.fromFloat(0);
    const negHalfPi = fp64.fromFloat(-Math.PI / 2);

    expect(fp64.toFloat(fp64.sin(halfPi))).toBeCloseTo(1, 3);
    expect(fp64.toFloat(fp64.cos(halfPi))).toBeCloseTo(0, 3);
    expect(fp64.toFloat(fp64.sin(zero))).toBeCloseTo(0, 6);
    expect(fp64.toFloat(fp64.sin(negHalfPi))).toBeCloseTo(-1, 3);
  });

  test("comparisons", () => {
    const a = fp64.fromInt(2);
    const b = fp64.fromInt(3);

    expect(fp64.eq(a, a)).toBe(true);
    expect(fp64.neq(a, b)).toBe(true);
    expect(fp64.gt(b, a)).toBe(true);
    expect(fp64.gte(a, a)).toBe(true);
    expect(fp64.lt(a, b)).toBe(true);
    expect(fp64.lte(a, b)).toBe(true);
  });

  test("wrap and scaleQ16 branches (bigint)", () => {
    const max = fp64.MAX;
    const min = fp64.MIN;
    const wrapped = fp64.add(max, 1n);
    expect(wrapped).toBe(min);

    expect(fp48.ONE > 0n).toBe(true);
    expect(fp32.ONE > 0n).toBe(true);
  });

  test("bigint LUT cache reuse", () => {
    const fpA = createFixedPoint({
      fractionBits: 16,
      totalBits: 64,
      useBigInt: true,
    }) as FixedPointOps<bigint>;
    const fpB = createFixedPoint({
      fractionBits: 16,
      totalBits: 64,
      useBigInt: true,
    }) as FixedPointOps<bigint>;
    expect(fpA.sin(fpA.fromInt(0))).toBe(fpB.sin(fpB.fromInt(0)));
  });
});

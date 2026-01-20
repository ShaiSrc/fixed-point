import { SIN_LUT_Q16 } from "./sin-lut-q16";

/**
 * Fixed-point storage type. Uses `number` for 32-bit or less, and `bigint` for wider widths.
 */
export type Fixed = number | bigint;

/**
 * Configuration for `createFixedPoint()`.
 */
export interface FixedPointConfig {
  /** Number of fractional bits in Qm.n. */
  fractionBits?: number;
  /** Total bit width for the fixed-point representation. */
  totalBits?: number;
  /** Force BigInt arithmetic even for <=32-bit widths. */
  useBigInt?: boolean;
}

/**
 * Operations for a fixed-point format. All values are stored as scaled integers.
 */
export interface FixedPointOps<T extends Fixed> {
  /** Alias for `FRACTION_BITS`. */
  readonly SHIFT: number;
  /** Fractional bits in the representation. */
  readonly FRACTION_BITS: number;
  /** Total bits in the representation. */
  readonly TOTAL_BITS: number;
  /** Fixed-point value for 1.0. */
  readonly ONE: T;
  /** Smallest representable step (1 LSB). */
  readonly EPSILON: T;
  /** Maximum representable value. */
  readonly MAX: T;
  /** Minimum representable value. */
  readonly MIN: T;

  /** Convert integer to fixed-point. */
  fromInt(n: number): T;
  /** Convert float to fixed-point (rounded). */
  fromFloat(f: number): T;
  /** Convert decimal string to fixed-point (rounded). */
  fromString(value: string): T;
  /** Convert fixed-point to float. */
  toFloat(val: T): number;
  /** Convert fixed-point to integer (floor toward zero for numbers). */
  toInt(a: T): T;

  /** Add two fixed-point values. */
  add(a: T, b: T): T;
  /** Subtract two fixed-point values. */
  sub(a: T, b: T): T;
  /** Negate a fixed-point value. */
  negate(a: T): T;
  /** Multiply two fixed-point values. */
  mul(a: T, b: T): T;
  /** Divide two fixed-point values. */
  div(a: T, b: T): T;
  /** Modulus of two fixed-point values. */
  mod(a: T, b: T): T;
  /** Absolute value. */
  abs(a: T): T;

  /** Sine using LUT (input in radians, fixed-point). */
  sin(theta: T): T;
  /** Cosine using LUT (input in radians, fixed-point). */
  cos(theta: T): T;
  /** Square root (non-negative only). */
  sqrt(a: T): T;

  /** Equality. */
  eq(a: T, b: T): boolean;
  /** Inequality. */
  neq(a: T, b: T): boolean;
  /** Greater than. */
  gt(a: T, b: T): boolean;
  /** Greater than or equal. */
  gte(a: T, b: T): boolean;
  /** Less than. */
  lt(a: T, b: T): boolean;
  /** Less than or equal. */
  lte(a: T, b: T): boolean;
}

/** Default fractional bits (Q16). */
const DEFAULT_FRACTION_BITS = 16;
/** Default total width (32-bit). */
const DEFAULT_TOTAL_BITS = 32;
/** LUT size for sine. */
const LUT_SIZE = SIN_LUT_Q16.length;

/** 2π in Q16. */
const TWO_PI_Q16 = 411775; // ~2*PI * 65536
/** π/2 in Q16. */
const PI_HALF_Q16 = 102944; // ~PI/2 * 65536

/** Cache for number-based LUTs keyed by fractionBits:totalBits. */
const numberLutCache = new Map<
  string,
  { sinLut: readonly number[]; TWO_PI: number; PI_HALF: number }
>();
/** Cache for BigInt-based LUTs keyed by fractionBits:totalBits. */
const bigIntLutCache = new Map<
  string,
  { sinLut: readonly bigint[]; TWO_PI: bigint; PI_HALF: bigint }
>();

/** Integer square root using Newton iteration. */
function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + n / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) >> 1n;
  }
  return x0;
}

/** Floor division for signed BigInt values. */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  if (r === 0n) return q;
  return a < 0n ? q - 1n : q;
}

/**
 * Parse decimal string into a fixed-point integer scaled by `fractionBits`.
 * Rounds to nearest with halves away from zero via floor division.
 */
function parseFixedPointString(value: string, fractionBits: number): bigint {
  if (typeof value !== "string") {
    throw new Error("Fixed-point string must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Fixed-point string is empty.");
  }

  let sign = 1n;
  let start = 0;
  const first = trimmed[0];
  if (first === "+") {
    start = 1;
  } else if (first === "-") {
    sign = -1n;
    start = 1;
  }

  const rest = trimmed.slice(start);
  const parts = rest.split(".");
  if (parts.length > 2) {
    throw new Error("Invalid fixed-point string.");
  }

  const intPartStr = parts[0] || "";
  const fracPartStr = parts[1] || "";

  if (intPartStr === "" && fracPartStr === "") {
    throw new Error("Invalid fixed-point string.");
  }
  if (!/^\d*$/.test(intPartStr) || !/^\d*$/.test(fracPartStr)) {
    throw new Error("Invalid fixed-point string.");
  }

  const intPart = intPartStr === "" ? 0n : BigInt(intPartStr);
  const fracPart = fracPartStr === "" ? 0n : BigInt(fracPartStr);
  const denom = fracPartStr === "" ? 1n : 10n ** BigInt(fracPartStr.length);

  const scaledBase = (intPart * denom + fracPart) << BigInt(fractionBits);
  const half = denom / 2n;
  const signedNumerator = sign * scaledBase;
  const rounded = floorDiv(signedNumerator + half, denom);

  return rounded;
}

/**
 * Create fixed-point operations for the specified configuration.
 */
export function createFixedPoint(
  config?: FixedPointConfig & { useBigInt?: false },
): FixedPointOps<number>;
/**
 * Create fixed-point operations backed by BigInt.
 */
export function createFixedPoint(
  config: FixedPointConfig & { useBigInt: true },
): FixedPointOps<bigint>;
/**
 * Create fixed-point operations using either number or BigInt storage.
 */
export function createFixedPoint(
  config: FixedPointConfig = {},
): FixedPointOps<number> | FixedPointOps<bigint> {
  const fractionBits = config.fractionBits ?? DEFAULT_FRACTION_BITS;
  const totalBits = config.totalBits ?? DEFAULT_TOTAL_BITS;

  if (!Number.isInteger(fractionBits) || !Number.isInteger(totalBits)) {
    throw new Error("Fixed-point config must use integer bit sizes.");
  }
  if (fractionBits <= 0) {
    throw new Error("fractionBits must be > 0.");
  }
  if (totalBits <= fractionBits) {
    throw new Error("totalBits must be greater than fractionBits.");
  }

  if (config.useBigInt === false && totalBits > 32) {
    throw new Error("useBigInt=false is not supported for totalBits > 32.");
  }

  const useBigInt = config.useBigInt ?? totalBits > 32;

  /** Wrap a BigInt into the configured signed range. */
  const wrapBigInt = (value: bigint): bigint => {
    const bits = BigInt(totalBits);
    const mask = (1n << bits) - 1n;
    const signBit = 1n << (bits - 1n);
    const wrapped = value & mask;
    return wrapped >= signBit ? wrapped - (1n << bits) : wrapped;
  };

  /** Wrap a number into the configured signed range. */
  const wrapNumber = (value: number): number => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error("Fixed-point values must be finite integers.");
    }
    if (totalBits === 32) return value | 0;
    const wrapped = wrapBigInt(BigInt(Math.trunc(value)));
    return Number(wrapped);
  };

  /** Scale a Q16 LUT value into the configured fraction bits. */
  const scaleQ16 = (value: number): number | bigint => {
    const diff = fractionBits - DEFAULT_FRACTION_BITS;
    if (useBigInt) {
      let v = BigInt(value);
      if (diff > 0) v <<= BigInt(diff);
      if (diff < 0) v >>= BigInt(-diff);
      return wrapBigInt(v);
    }

    let v = value;
    if (diff > 0) v = Number(BigInt(value) << BigInt(diff));
    if (diff < 0) v = Number(BigInt(value) >> BigInt(-diff));
    return wrapNumber(v);
  };

  if (useBigInt) {
    const ONE = 1n << BigInt(fractionBits);
    const EPSILON = 1n;
    const MAX = (1n << BigInt(totalBits - 1)) - 1n;
    const MIN = -(1n << BigInt(totalBits - 1));
    const cacheKey = `${fractionBits}:${totalBits}`;
    let cached = bigIntLutCache.get(cacheKey);
    if (!cached) {
      cached = {
        TWO_PI: scaleQ16(TWO_PI_Q16) as bigint,
        PI_HALF: scaleQ16(PI_HALF_Q16) as bigint,
        sinLut: SIN_LUT_Q16.map((v) => scaleQ16(v) as bigint),
      };
      bigIntLutCache.set(cacheKey, cached);
    }
    const { TWO_PI, PI_HALF, sinLut } = cached;

    /** Sine using the LUT (BigInt path). */
    const sin = (theta: bigint) => {
      let t = theta % TWO_PI;
      if (t < 0n) t += TWO_PI;
      const idx = (t * BigInt(LUT_SIZE)) / TWO_PI;
      return sinLut[Number(idx % BigInt(LUT_SIZE))];
    };
    /** Cosine using the LUT (BigInt path). */
    const cos = (theta: bigint) => sin(wrapBigInt(theta + PI_HALF));

    return {
      SHIFT: fractionBits,
      FRACTION_BITS: fractionBits,
      TOTAL_BITS: totalBits,
      ONE,
      EPSILON,
      MAX,
      MIN,
      fromInt: (n: number) => wrapBigInt(BigInt(n) << BigInt(fractionBits)),
      fromFloat: (f: number) => wrapBigInt(BigInt(Math.round(f * Number(ONE)))),
      fromString: (value: string) =>
        wrapBigInt(parseFixedPointString(value, fractionBits)),
      toFloat: (val: bigint) => Number(val) / Number(ONE),
      toInt: (a: bigint) => a / ONE,
      add: (a: bigint, b: bigint) => wrapBigInt(a + b),
      sub: (a: bigint, b: bigint) => wrapBigInt(a - b),
      negate: (a: bigint) => wrapBigInt(-a),
      mul: (a: bigint, b: bigint) =>
        wrapBigInt((a * b) >> BigInt(fractionBits)),
      div: (a: bigint, b: bigint) => {
        if (b === 0n)
          throw new Error("Division by zero in fixed-point arithmetic");
        return wrapBigInt((a << BigInt(fractionBits)) / b);
      },
      mod: (a: bigint, b: bigint) => {
        if (b === 0n)
          throw new Error("Division by zero in fixed-point arithmetic");
        return wrapBigInt(a % b);
      },
      abs: (a: bigint) => (a < 0n ? wrapBigInt(-a) : a),
      sin,
      cos,
      sqrt: (a: bigint) => {
        if (a < 0n) throw new Error("Sqrt of negative number");
        const val = a * ONE;
        const res = isqrt(val);
        return wrapBigInt(res);
      },
      eq: (a: bigint, b: bigint) => a === b,
      neq: (a: bigint, b: bigint) => a !== b,
      gt: (a: bigint, b: bigint) => a > b,
      gte: (a: bigint, b: bigint) => a >= b,
      lt: (a: bigint, b: bigint) => a < b,
      lte: (a: bigint, b: bigint) => a <= b,
    };
  }

  /** Validate that a number is a finite integer fixed-point value. */
  const assertInteger = (value: number, name: string) => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${name} must be a finite integer fixed-point value.`);
    }
  };

  const ONE = 2 ** fractionBits;
  const EPSILON = 1;
  const MAX = 2 ** (totalBits - 1) - 1;
  const MIN = -(2 ** (totalBits - 1));
  const cacheKey = `${fractionBits}:${totalBits}`;
  let cached = numberLutCache.get(cacheKey);
  if (!cached) {
    cached = {
      TWO_PI: scaleQ16(TWO_PI_Q16) as number,
      PI_HALF: scaleQ16(PI_HALF_Q16) as number,
      sinLut: SIN_LUT_Q16.map((v) => scaleQ16(v) as number),
    };
    numberLutCache.set(cacheKey, cached);
  }
  const { TWO_PI, PI_HALF, sinLut } = cached;

  /** Sine using the LUT (number path). */
  const sin = (theta: number) => {
    assertInteger(theta, "theta");
    let t = theta % TWO_PI;
    if (t < 0) t += TWO_PI;
    const idx = Number((BigInt(t) * BigInt(LUT_SIZE)) / BigInt(TWO_PI));
    return sinLut[idx % LUT_SIZE];
  };
  /** Cosine using the LUT (number path). */
  const cos = (theta: number) => sin(wrapNumber(theta + PI_HALF));

  return {
    SHIFT: fractionBits,
    FRACTION_BITS: fractionBits,
    TOTAL_BITS: totalBits,
    ONE,
    EPSILON,
    MAX,
    MIN,
    fromInt: (n: number) => {
      assertInteger(n, "n");
      return wrapNumber(n * ONE);
    },
    fromFloat: (f: number) => wrapNumber(Math.round(f * ONE)),
    fromString: (value: string) =>
      wrapNumber(Number(parseFixedPointString(value, fractionBits))),
    toFloat: (val: number) => val / ONE,
    toInt: (a: number) => Math.trunc(a / ONE),
    add: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return wrapNumber(a + b);
    },
    sub: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return wrapNumber(a - b);
    },
    negate: (a: number) => {
      assertInteger(a, "a");
      return wrapNumber(-a);
    },
    mul: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      const res = (BigInt(a) * BigInt(b)) >> BigInt(fractionBits);
      return wrapNumber(Number(res));
    },
    div: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      if (b === 0)
        throw new Error("Division by zero in fixed-point arithmetic");
      const res = (BigInt(a) << BigInt(fractionBits)) / BigInt(b);
      return wrapNumber(Number(res));
    },
    mod: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      if (b === 0)
        throw new Error("Division by zero in fixed-point arithmetic");
      const res = BigInt(a) % BigInt(b);
      return wrapNumber(Number(res));
    },
    abs: (a: number) => {
      assertInteger(a, "a");
      return a < 0 ? wrapNumber(-a) : a;
    },
    sin,
    cos,
    sqrt: (a: number) => {
      assertInteger(a, "a");
      if (a < 0) throw new Error("Sqrt of negative number");
      const val = BigInt(a) * BigInt(ONE);
      const res = isqrt(val);
      return wrapNumber(Number(res));
    },
    eq: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a === b;
    },
    neq: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a !== b;
    },
    gt: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a > b;
    },
    gte: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a >= b;
    },
    lt: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a < b;
    },
    lte: (a: number, b: number) => {
      assertInteger(a, "a");
      assertInteger(b, "b");
      return a <= b;
    },
  };
}

/** Default fixed-point ops (Q16.16, 32-bit, number-backed). */
export const fp = createFixedPoint() as FixedPointOps<number>;

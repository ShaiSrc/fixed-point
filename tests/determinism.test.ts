import { createFixedPoint, FixedPointOps } from "../src/fixed-point";

type Rng = () => number;

const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
};

const randInt = (rng: Rng, min: number, max: number): number => {
  const span = max - min + 1;
  return min + (rng() % span);
};

describe("determinism across number/bigint", () => {
  const fpNum = createFixedPoint({
    fractionBits: 16,
    totalBits: 32,
    useBigInt: false,
  }) as FixedPointOps<number>;
  const fpBig = createFixedPoint({
    fractionBits: 16,
    totalBits: 32,
    useBigInt: true,
  }) as FixedPointOps<bigint>;

  const assertSame = (actual: number, expected: bigint) => {
    expect(BigInt(actual)).toBe(expected);
  };

  test("golden vectors for fromInt/fromFloat", () => {
    const ints = [-1024, -17, -1, 0, 1, 2, 17, 1024];
    for (const n of ints) {
      assertSame(fpNum.fromInt(n), fpBig.fromInt(n));
    }

    const floats = [
      -1024.5, -2.25, -1.1, -0.5, 0, 0.1, 0.5, 1.25, 2.5, 123.456,
    ];
    for (const f of floats) {
      assertSame(fpNum.fromFloat(f), fpBig.fromFloat(f));
    }
  });

  test("fromString determinism", () => {
    const values = ["2", "2.", ".5", "-0.5", "+3.25"];
    for (const v of values) {
      assertSame(fpNum.fromString(v), fpBig.fromString(v));
    }
  });

  test("arithmetic ops match bigint oracle", () => {
    const rng = createRng(0x5eeda5e);
    for (let i = 0; i < 2000; i += 1) {
      const aInt = randInt(rng, -5000, 5000);
      const bInt = randInt(rng, -5000, 5000) || 1;

      const aN = fpNum.fromInt(aInt);
      const bN = fpNum.fromInt(bInt);
      const aB = fpBig.fromInt(aInt);
      const bB = fpBig.fromInt(bInt);

      assertSame(fpNum.add(aN, bN), fpBig.add(aB, bB));
      assertSame(fpNum.sub(aN, bN), fpBig.sub(aB, bB));
      assertSame(fpNum.negate(aN), fpBig.negate(aB));
      assertSame(fpNum.abs(aN), fpBig.abs(aB));
      assertSame(fpNum.mul(aN, bN), fpBig.mul(aB, bB));
      assertSame(fpNum.div(aN, bN), fpBig.div(aB, bB));
      assertSame(fpNum.mod(aN, bN), fpBig.mod(aB, bB));
    }
  });

  test("sqrt/sin/cos match bigint oracle", () => {
    const rng = createRng(0xdecafbad);
    for (let i = 0; i < 500; i += 1) {
      const aInt = randInt(rng, 0, 5000);
      const aN = fpNum.fromInt(aInt);
      const aB = fpBig.fromInt(aInt);
      assertSame(fpNum.sqrt(aN), fpBig.sqrt(aB));
    }

    const angles = [
      -2 * Math.PI,
      -Math.PI,
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
      2 * Math.PI,
      3 * (Math.PI / 2),
    ];

    for (const theta of angles) {
      const tN = fpNum.fromFloat(theta);
      const tB = fpBig.fromFloat(theta);
      assertSame(fpNum.sin(tN), fpBig.sin(tB));
      assertSame(fpNum.cos(tN), fpBig.cos(tB));
    }
  });

  test("comparisons match bigint oracle", () => {
    const rng = createRng(0x1234abcd);
    for (let i = 0; i < 1000; i += 1) {
      const aInt = randInt(rng, -10000, 10000);
      const bInt = randInt(rng, -10000, 10000);
      const aN = fpNum.fromInt(aInt);
      const bN = fpNum.fromInt(bInt);
      const aB = fpBig.fromInt(aInt);
      const bB = fpBig.fromInt(bInt);

      expect(fpNum.eq(aN, bN)).toBe(fpBig.eq(aB, bB));
      expect(fpNum.neq(aN, bN)).toBe(fpBig.neq(aB, bB));
      expect(fpNum.gt(aN, bN)).toBe(fpBig.gt(aB, bB));
      expect(fpNum.gte(aN, bN)).toBe(fpBig.gte(aB, bB));
      expect(fpNum.lt(aN, bN)).toBe(fpBig.lt(aB, bB));
      expect(fpNum.lte(aN, bN)).toBe(fpBig.lte(aB, bB));
    }
  });
});

# ShaiSrc/fixed-point

**Deterministic fixed-point math for lockstep simulations and reproducible game logic.**

Floating-point operations can diverge across platforms—`0.1 + 0.2` isn't always the same bitwise result on different CPUs or JS engines. For multiplayer games using lockstep networking or any simulation that must replay identically, you need **bitwise-identical math**.

This library provides a full suite of fixed-point arithmetic (add, multiply, sqrt, sin, cos, etc.) with a hardcoded sine lookup table, so every peer computes exactly the same results.

Built for my deterministic ECS TypeScript game engine (based on bitecs), extracted as a standalone package for anyone who needs it.

## Features

- Strict determinism with a hardcoded sine LUT
- Configurable fractional and total bit sizes
- 32-bit number mode by default, BigInt mode for >32-bit
- The default `fp` instance uses 16.16 format (see [Determinism details](#determinism-details))

## Quick example

```ts
import { fp } from "@shaisrc/fixed-point";

const a = fp.fromFloat(1.5); // 1.5 in fixed-point
const b = fp.fromInt(2); // 2 in fixed-point
const result = fp.mul(a, b); // 3.0

console.log(fp.toFloat(result)); // 3
```

## Install

```bash
npm install @shaisrc/fixed-point
```

## Usage

```ts
import { fp, createFixedPoint } from "@shaisrc/fixed-point";

const a = fp.fromFloat(1.5);
const b = fp.fromInt(2);
const c = fp.mul(a, b);

const precise = fp.fromString("0.1"); // deterministic decimal parsing

const highPrecision = createFixedPoint({ fractionBits: 20, totalBits: 64 });
const x = highPrecision.fromFloat(0.1);
```

## API

**Conversion**

- `fromInt`, `fromFloat`, `fromString`, `toInt`, `toFloat`

**Arithmetic**

- `add`, `sub`, `mul`, `div`, `mod`
- `negate`, `abs`, `sqrt`

**Trigonometry**

- `sin`, `cos`

**Comparison**

- `eq`, `neq`, `gt`, `gte`, `lt`, `lte`

```ts
// All operations return the same fixed-point type (number or bigint)
fp.add(a, b); // a + b
fp.sqrt(x); // √x
fp.sin(angle); // sine (angle in radians as fixed-point)
fp.eq(a, b); // boolean: a === b
```

## Determinism details

This package avoids floating-point math at runtime. Trigonometry uses a fixed lookup table generated for Q16.16 format (16 integer bits, 16 fractional bits) and scaled deterministically to other configurations.

## When to use

**Use this library when:**

- Building deterministic multiplayer games (lockstep networking)
- Replaying game simulations from saved inputs
- Running physics on both server and client with identical results

**Don’t use this if:**

- You only need consistency within a single runtime (regular `number` is fine)
- You need very large dynamic range (stick to `float64`)

## Performance

Fixed-point math is faster than arbitrary-precision libraries but slower than native floating-point. Trigonometry hits a LUT, so `sin`/`cos` are O(1).

## Examples and tests

For runnable examples demonstrating lockstep behavior and edge cases, see the test suite in [tests/fixed-point.test.ts](tests/fixed-point.test.ts) and the determinism checks in [tests/determinism.test.ts](tests/determinism.test.ts).

## Configuration

- `fractionBits`: number of fractional bits (default 16)
- `totalBits`: total width (default 32). Use >32 to enable BigInt-backed ops.
- `useBigInt`: required when `totalBits > 32`

## Common gotchas

**Precision loss**: `fromFloat(0.333333)` will truncate based on `fractionBits`. For Q16.16, you get ~5 decimal digits.

**Overflow**: Values wrap at `totalBits`. `add(maxValue, 1)` wraps to `minValue` (two's complement).

**Angles**: `sin`/`cos` expect angles in radians _as fixed-point values_. Convert degrees first:

```ts
const degrees = fp.fromInt(90);
const radians = fp.mul(degrees, fp.fromFloat(Math.PI / 180));
fp.sin(radians);
```

## Notes

- Values wrap at the configured width (two’s complement).
- The library throws on invalid inputs (NaN, division by zero, etc.) to catch bugs early.

## License

MIT

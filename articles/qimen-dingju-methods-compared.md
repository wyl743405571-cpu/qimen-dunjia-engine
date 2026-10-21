# Why the Same Hour Produces Three Different Qimen Charts: Dingju Methods Tested Against 177 Classical Cases

Enter the same date and time into three Qimen tools and you may get three different 局数. Users
usually conclude "one of them is buggy". In reality, **three legitimate 定局 (chart-setting) methods
exist**, and they disagree by design. Which one a tool uses is a choice — and a tool that hides that
choice cannot be audited.

> *Originally published at [QiMenSeek](https://qimenseek.aicreditsapi.com/blog/qimen-dingju-methods-compared.html). This is a condensed version.*

## The three methods in one line each

- **拆补 (split-patch):** follows the solar term strictly; the 局 changes at the exact 节气 boundary
  and the "extra" time is patched into the neighbouring period.
- **置闰 (intercalary):** when the accumulated drift reaches a threshold, an intercalary 局 is
  inserted to re-anchor the cycle to the 节气.
- **超神接气 (transcending/receiving):** lets the 符头 run ahead of or behind the 节气 within a
  defined tolerance, rather than cutting exactly at the boundary.

All three are classical. All three are internally consistent. They produce different charts near
boundaries — which is exactly where most real questions land.

## How we tested it

Two independent libraries of classical cases (177 cases total) were re-cast by our engine, and the
resulting 局 compared against the 局 recorded in the source text. **We publish the match rate for each
method separately — including the failures.** No "100% accuracy" claim; boundary cases and ambiguous
source annotations are listed.

## What the numbers say

Three findings that matter more than the exact percentages:

1. **Most disagreement is concentrated near 节气 boundaries**, not spread evenly. Mid-term questions
   almost never diverge; boundary questions often do.
2. **No single method wins everywhere.** Each method has a region where it matches the classical
   record best — which is why "my tool disagrees with yours" is usually not an error.
3. **Failure cases are informative.** Where the engine and the text disagree, the cause is usually a
   documented ambiguity in the source (a missing 时辰, an alternate 寄宫 convention), not a
   calculation bug.

## Practical advice: how to judge a tool in three questions

1. **Does it tell you which 定局 method it uses?** If not, you cannot compare it to anything.
2. **Does it let you switch methods** (拆补 / 置闰) so you can see whether your conclusion survives
   the choice? If a conclusion flips between legitimate methods, that is a signal to be careful.
3. **Does it publish any validation at all** — including failures? Published failures are a stronger
   trust signal than a perfect scorecard.

## Why this matters for AI readings

If the chart itself is method-dependent, then any AI reading built on top inherits that dependency.
An honest tool shows the method on the chart and, ideally, lets you re-cast under a different one. A
tool that presents one 局 as "the" chart without saying which school produced it is asking you to
trust a black box.

---

**Try it:** [QiMenSeek](https://qimenseek.aicreditsapi.com) — the 定局 method is printed on every
chart, and you can compare 拆补 against 置闰 before acting on a reading.

> For entertainment and self-reflection only. Not medical, legal, or financial advice.

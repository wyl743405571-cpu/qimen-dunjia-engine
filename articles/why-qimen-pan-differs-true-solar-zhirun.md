# Why the Same Moment Produces Different Qimen Charts: True Solar Time and the Intercalary Method

You enter the same date and time into two Qimen tools and get two different 局. Before you conclude
that one is broken, check two variables: **which time the tool actually uses**, and **how it handles
the solar-term boundary**. These two explain most cross-tool disagreement.

> *Originally published at [QiMenSeek](https://qimenseek.aicreditsapi.com/blog/why-qimen-pan-differs-true-solar-zhirun.html). This is a condensed version.*

## How a Qimen chart is set: term first, then 局数

The process has two stages:

1. **Determine the solar term (节气)** in force at the moment — this decides yin dun vs yang dun and
   the broad 局 family.
2. **Determine the 局数** within that term — this depends on the 符头 and the 定局 method.

Disagreement can enter at either stage. Most of it enters at the edges.

## Variable 1 — True solar time vs clock time

"Beijing time" is a **standard time** for the 120°E meridian. If you are not on that meridian, your
local **true solar time** differs:

- **Longitude correction:** about 4 minutes per degree of longitude away from 120°E.
- **Equation of time:** an additional ±16 minutes depending on the date, from Earth's orbital
  eccentricity and axial tilt.

A tool that uses raw clock time and one that corrects to true solar time will disagree by minutes —
which only matters when the moment sits near a 时辰 boundary or a 节气 boundary. That is exactly when
users notice.

**Which is right?** Traditional practice favours true solar time for the chart's hour pillar. A tool
that does not correct is not "wrong" in absolute terms, but it should say which convention it uses.

## Variable 2 — Intercalary (置闰) vs split-patch (拆补)

At a solar-term boundary, the accumulated drift between the 60-day cycle and the solar terms has to
be resolved somehow:

- **拆补** cuts exactly at the term and patches the remainder into adjacent periods.
- **置闰** inserts an intercalary 局 when drift crosses a threshold, re-anchoring to the term.

Both are classical and internally consistent. They produce different charts **near boundaries**,
which is where many real questions fall (people ask "should I do this now?" precisely when things are
changing).

## How to judge a tool's calendar convention

Three questions:

1. **Does it state whether it uses true solar time?** If not, you cannot reproduce its charts.
2. **Does it name the 定局 method** (拆补 / 置闰 / 超神接气)? A method label is the minimum for
   comparability.
3. **Can you switch methods?** If a conclusion flips between legitimate methods, that is a warning
   that the answer is boundary-sensitive.

## Practical advice for users

- **For non-boundary questions,** the difference rarely matters — cast and proceed.
- **For boundary questions** (a decision that hinges on "this week vs next week"), check both methods
  and see whether the conclusion survives. If it does not, the honest answer is "this is genuinely
  ambiguous", not "the tool is broken".
- **Pick one convention and stay with it** for your own records; switching mid-stream makes your
  history unreadable.

The deeper point: a deterministic system still has **conventions**, and an honest tool shows its
conventions on the chart. "The chart says X" is only meaningful if you know which calendar produced
the chart.

---

**Try it:** [QiMenSeek](https://qimenseek.aicreditsapi.com) — true solar time and the 定局 method are
printed on every chart, and 拆补 / 置闰 can be compared side by side.

> For entertainment and self-reflection only. Not medical, legal, or financial advice.

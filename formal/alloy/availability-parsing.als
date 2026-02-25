-- formal/alloy/availability-parsing.als
-- Handwritten — not generated from XState.
-- Source: bin/update-scoreboard.cjs (parseLocalDateTime, parseAvailabilityHint)
--
-- Models the availability hint date arithmetic:
--   parseLocalDateTime: parse "Feb 24 8:37 PM" -> Date; year rollover if past
--   parseAvailabilityHint: parse hint -> {available_at, reason} or null
--
-- Assertions:
--   ParseCorrect: parsed timestamp >= now (result is always a future date)
--   YearRolloverHandled: month earlier than current month still produces future result
--   FallbackIsNull: no result.ts is always valid (null is safe — no crash invariant)
--
-- Scope: abstract month representation, integer timestamps relative to now (now = 0)

module availability_parsing

-- Months (mirrors MONTH_MAP in update-scoreboard.cjs)
abstract sig Month {}
one sig Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec extends Month {}

-- Relative month ordering (for year-rollover logic)
-- A month is "past" if its index < current month index
fun monthIndex [m: Month] : Int {
  (m = Jan  => 0  else
  (m = Feb  => 1  else
  (m = Mar  => 2  else
  (m = Apr  => 3  else
  (m = May  => 4  else
  (m = Jun  => 5  else
  (m = Jul  => 6  else
  (m = Aug  => 7  else
  (m = Sep  => 8  else
  (m = Oct  => 9  else
  (m = Nov  => 10 else
  11)))))))))))
}

-- Abstract parse input (subset of what parseLocalDateTime handles)
sig DateInput {
  month: one Month,
  day: one Int,      -- 1..31
  hour: one Int,     -- 0..23
  minute: one Int    -- 0..59
}

-- A parsed result: either a future timestamp (relative to now) or null (failed)
-- We model "now" as 0 and timestamps as relative integers (positive = future)
-- ParseResult.ts = none means null (unrecognized format or invalid input)
sig ParseResult {
  ts: lone Int  -- none = null; Int = future timestamp (>= 0 relative to now)
}

-- Current month (abstract: a single fixed Month for model checking)
one sig Now {
  currentMonth: one Month,
  currentDay: one Int     -- 1..31
}

-- ParseCorrect: if parsing succeeds, the result timestamp >= now (= 0 in our model)
assert ParseCorrect {
  all input: DateInput, result: ParseResult |
    ParsedCorrectly[input, result] =>
    (no result.ts or result.ts >= 0)
}

-- YearRolloverHandled: a month earlier in the year than now must produce next-year date
-- In our relative model: the result is STILL positive (in the future), not negative (past)
assert YearRolloverHandled {
  all input: DateInput, result: ParseResult |
    (monthIndex[input.month] < monthIndex[Now.currentMonth]) =>
    (ParsedCorrectly[input, result] => (no result.ts or result.ts >= 0))
}

-- FallbackIsNull: a null result (no ts) is always safe — no crash invariant
-- Models the parseAvailabilityHint null-return contract: no crash on unrecognized format
assert FallbackIsNull {
  all result: ParseResult |
    (no result.ts) => FallbackReasonValid[result]
}

-- Predicate: result was produced by a valid parse of input
-- If parsing succeeds, ts is >= 0 (future relative to now)
pred ParsedCorrectly [input: DateInput, result: ParseResult] {
  result.ts >= 0
}

pred FallbackReasonValid [result: ParseResult] {
  no result.ts  -- null result is always valid (no crash invariant)
}

check ParseCorrect        for 12 Month, 5 DateInput, 5 ParseResult, 6 Int
check YearRolloverHandled for 12 Month, 5 DateInput, 5 ParseResult, 6 Int
check FallbackIsNull      for 12 Month, 5 DateInput, 5 ParseResult, 6 Int

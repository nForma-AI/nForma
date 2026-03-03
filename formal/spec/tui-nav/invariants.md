# Liveness Fairness Declarations: tui-nav

**Spec source:** `formal/tla/TUINavigation.tla`
**Config:** `formal/tla/MCTUINavigation.cfg`

## EscapeProgress

**Property:** `EscapeProgress == [][EscapeUp => depth' < depth]_vars`
**Config line:** `PROPERTY EscapeProgress` (MCTUINavigation.cfg)
**Fairness assumption:** None required (temporal safety property, not liveness).
**Status:** VERIFIED by TLC ✓

`EscapeProgress` is a box-formula (always-predicate on transitions), not a leads-to or eventually property. It states that whenever `EscapeUp` fires, `depth` strictly decreases. Trivially true by construction (EscapeUp sets `depth' = depth - 1`) and requires no fairness. TLC verifies it over 5 distinct states in under 1 second.

**Source:** `formal/tla/TUINavigation.tla` (EscapeProgress)

---

## EventuallyExits and MainMenuReachable — NOT CHECKED (user-cooperation properties)

**Properties:**
- `EventuallyExits == <>(exited = TRUE)`
- `MainMenuReachable == (~exited /\ depth > 0) ~> (depth = 0 \/ exited)`

**Status:** Excluded from MCTUINavigation.cfg — NOT verifiable without a cooperative user model.

**TLC finding (2026-02-28):** When these properties were added to PROPERTY checks, TLC found two distinct lasso counterexamples:

1. **Lasso 1 (with WF_vars(EscapeExit)):** `depth=0 → depth=1 → depth=0 → …` forever. User bounces between main menu and a sub-flow, never triggering EscapeExit. WF_vars(EscapeExit) does not prevent this lasso because EscapeExit alternates enabled (depth=0) and disabled (depth=1) — WF only fires when continuously enabled in an infinite suffix.

2. **Lasso 2 (with SF_vars(EscapeExit)):** `depth=1 → depth=2 → depth=1 → …` forever. EscapeExit is **never enabled** inside this cycle (depth never reaches 0), so even strong fairness on EscapeExit cannot break it. The user oscillates between the field-picker and value-input screens, never pressing ESC at the slot picker.

**Root cause:** The abstract user model allows infinite `Select` actions. No WF/SF constraint on escape actions can prevent a user from repeatedly navigating deeper and pressing ESC just one level up. Liveness requires fairness on `Select` itself (e.g., "Select cannot fire infinitely without an EscapeUp eventually reaching depth=0"), which goes beyond standard WF/SF and requires a fully cooperative user model.

**What the code DOES guarantee (verified):** `NoDeadlock + DepthBounded + EscapeProgress` together prove that exit is always reachable in at most `MaxDepth` ESC presses from any state. The code guarantees the escape path exists and is never blocked; it cannot enforce the user to take it.

**Source:** `formal/tla/TUINavigation.tla` (definitions retained for documentation, not checked by MCTUINavigation.cfg)

-- .planning/formal/alloy/solve-tui-features.als
-- Models the solve TUI interactive terminal interface (SOLVE-16) and
-- category-aware action menus with requirement/TODO creation (SOLVE-17).
-- Source: bin/solve-tui.cjs
--
-- @requirement SOLVE-16
-- @requirement SOLVE-17

module solve_tui_features

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── SOLVE-16: TUI browsable interface ─────────────────────────────────

-- @requirement SOLVE-16
-- Four diagnostic categories the TUI can browse
abstract sig DiagnosticCategory {}
one sig DtoC, CtoR, TtoR, DtoR extends DiagnosticCategory {}

-- @requirement SOLVE-16
-- TUI navigation has exactly 3 depth levels (category -> item list -> item detail)
abstract sig NavDepth {}
one sig CategoryLevel, ItemListLevel, ItemDetailLevel extends NavDepth {}

-- @requirement SOLVE-16
sig TUISession {
  browseCategories: set DiagnosticCategory,
  navigationDepths: set NavDepth,
  hasPagination: one Bool,
  hasFalsePositiveAck: one Bool,
  hasRegexSuppression: one Bool,
  hasFileContextView: one Bool
}

-- @requirement SOLVE-16
-- TUI covers all four diagnostic categories
fact AllCategoriesBrowsable {
  all t: TUISession |
    t.browseCategories = DiagnosticCategory
}

-- @requirement SOLVE-16
-- TUI has exactly 3-depth navigation
fact ThreeDepthNavigation {
  all t: TUISession |
    t.navigationDepths = NavDepth and
    #t.navigationDepths = 3
}

-- @requirement SOLVE-16
-- TUI supports pagination, false-positive ack, regex suppression, file context
fact CoreTUIFeatures {
  all t: TUISession |
    t.hasPagination = True and
    t.hasFalsePositiveAck = True and
    t.hasRegexSuppression = True and
    t.hasFileContextView = True
}

-- ── SOLVE-17: Category-aware action menus ─────────────────────────────

-- @requirement SOLVE-17
-- Actions available per category in item detail view
abstract sig ItemAction {}
one sig CreateRequirement, CreateTODO, SuppressRebrand extends ItemAction {}

-- @requirement SOLVE-17
sig CategoryActionMenu {
  category: one DiagnosticCategory,
  actions: set ItemAction,
  hasDuplicateDetection: one Bool,
  hasAtomicWrites: one Bool
}

-- @requirement SOLVE-17
-- C->R, T->R, D->R items get "Create Requirement" action
fact ReverseDiscoveryActions {
  all m: CategoryActionMenu |
    (m.category in CtoR + TtoR + DtoR) implies
      CreateRequirement in m.actions
}

-- @requirement SOLVE-17
-- D->C items get "Create TODO" action
fact DtoCActions {
  all m: CategoryActionMenu |
    (m.category = DtoC) implies
      CreateTODO in m.actions
}

-- @requirement SOLVE-17
-- D->C items with rebrand path patterns are auto-suppressed
fact RebrandAutoSuppression {
  all m: CategoryActionMenu |
    (m.category = DtoC) implies
      SuppressRebrand in m.actions
}

-- @requirement SOLVE-17
-- Requirement creation uses duplicate detection and atomic writes
fact RequirementCreationSafety {
  all m: CategoryActionMenu |
    (CreateRequirement in m.actions) implies
      (m.hasDuplicateDetection = True and m.hasAtomicWrites = True)
}

-- Assertions
assert AllFourCategories {
  all t: TUISession | #t.browseCategories = 4
}

assert ThreeNavDepths {
  all t: TUISession | #t.navigationDepths = 3
}

assert ReverseItemsGetCreateReq {
  all m: CategoryActionMenu |
    m.category in (CtoR + TtoR + DtoR) implies
      CreateRequirement in m.actions
}

assert DtoCItemsGetCreateTODO {
  all m: CategoryActionMenu |
    m.category = DtoC implies CreateTODO in m.actions
}

assert DuplicateDetectionOnReqCreation {
  all m: CategoryActionMenu |
    CreateRequirement in m.actions implies
      m.hasDuplicateDetection = True
}

check AllFourCategories for 3 but 3 TUISession
check ThreeNavDepths for 3 but 3 TUISession
check ReverseItemsGetCreateReq for 5 but 5 CategoryActionMenu
check DtoCItemsGetCreateTODO for 5 but 5 CategoryActionMenu
check DuplicateDetectionOnReqCreation for 5 but 5 CategoryActionMenu

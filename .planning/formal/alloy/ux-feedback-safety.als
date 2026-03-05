-- .formal/alloy/ux-feedback-safety.als
-- Models UX heuristics: immediate feedback, destructive action confirmation,
-- and human-readable error messages with recovery guidance.
-- Source: qgsd-baseline requirements
--
-- @requirement UX-01
-- @requirement UX-02
-- @requirement UX-03

module ux_feedback_safety

-- Bool helper
abstract sig Bool {}
one sig True, False extends Bool {}

-- UX-01: Action feedback
-- @requirement UX-01
sig UserAction {
  hasImmediateFeedback: one Bool,
  hasCompletionFeedback: one Bool
}

-- UX-01: Every user action produces immediate + completion feedback
-- @requirement UX-01
fact AllActionsHaveFeedback {
  all a: UserAction |
    a.hasImmediateFeedback = True and
    a.hasCompletionFeedback = True
}

assert NoSilentActions {
  no a: UserAction |
    a.hasImmediateFeedback = False or a.hasCompletionFeedback = False
}

-- UX-02: Destructive action confirmation
-- @requirement UX-02
abstract sig ActionType {}
one sig Destructive, NonDestructive extends ActionType {}

sig ConfirmableAction {
  actionType: one ActionType,
  requiresConfirmation: one Bool,
  hasUndo: one Bool
}

-- UX-02: Destructive actions require confirmation OR undo
-- @requirement UX-02
fact DestructiveActionsProtected {
  all a: ConfirmableAction |
    a.actionType = Destructive implies
      (a.requiresConfirmation = True or a.hasUndo = True)
}

assert DestructiveNeverUnprotected {
  no a: ConfirmableAction |
    a.actionType = Destructive and
    a.requiresConfirmation = False and
    a.hasUndo = False
}

-- UX-03: Error messages
-- @requirement UX-03
sig ErrorMessage {
  isHumanReadable: one Bool,
  explainsWhatWentWrong: one Bool,
  suggestsNextStep: one Bool
}

-- UX-03: All error messages must be readable, explanatory, and actionable
-- @requirement UX-03
fact ErrorMessagesActionable {
  all e: ErrorMessage |
    e.isHumanReadable = True and
    e.explainsWhatWentWrong = True and
    e.suggestsNextStep = True
}

assert NoOpaqueErrors {
  no e: ErrorMessage |
    e.isHumanReadable = False or
    e.explainsWhatWentWrong = False or
    e.suggestsNextStep = False
}

-- Verification commands
check NoSilentActions for 5
check DestructiveNeverUnprotected for 5
check NoOpaqueErrors for 5

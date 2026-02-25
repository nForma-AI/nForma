import { setup, assign, createActor } from 'xstate';
export { createActor };

export interface QGSDContext {
  slotsAvailable:     number;
  successCount:       number;
  deliberationRounds: number;
  currentPhase:       string;
  maxDeliberation:    number;
}

export type QGSDEvent =
  | { type: 'QUORUM_START';    slotsAvailable: number }
  | { type: 'VOTES_COLLECTED'; successCount: number }
  | { type: 'DELIBERATE' }
  | { type: 'DECIDE';          outcome: 'APPROVE' | 'BLOCK' };

export const qgsdWorkflowMachine = setup({
  types: {
    context: {} as QGSDContext,
    events:  {} as QGSDEvent,
  },
  guards: {
    minQuorumMet: ({ context }) =>
      context.successCount >= Math.ceil(context.slotsAvailable / 2),

    noInfiniteDeliberation: ({ context }) =>
      context.deliberationRounds < context.maxDeliberation,

    phaseMonotonicallyAdvances: () => true,
  },
}).createMachine({
  id:      'qgsd-workflow',
  initial: 'IDLE',
  context: {
    slotsAvailable:     0,
    successCount:       0,
    deliberationRounds: 0,
    currentPhase:       'IDLE',
    maxDeliberation:    7,
  },
  states: {
    IDLE: {
      on: {
        QUORUM_START: {
          target: 'COLLECTING_VOTES',
          actions: assign({
            slotsAvailable: ({ event }) => event.slotsAvailable,
            currentPhase:   () => 'COLLECTING_VOTES',
          }),
        },
      },
    },
    COLLECTING_VOTES: {
      on: {
        VOTES_COLLECTED: [
          {
            guard:   'minQuorumMet',
            target:  'DECIDED',
            actions: assign({
              successCount:  ({ event }) => event.successCount,
              currentPhase:  () => 'DECIDED',
            }),
          },
          {
            target:  'DELIBERATING',
            actions: assign({
              successCount:       ({ event }) => event.successCount,
              deliberationRounds: ({ context }) => context.deliberationRounds + 1,
              currentPhase:       () => 'DELIBERATING',
            }),
          },
        ],
      },
    },
    DELIBERATING: {
      on: {
        VOTES_COLLECTED: [
          {
            guard:   'minQuorumMet',
            target:  'DECIDED',
            actions: assign({
              successCount:  ({ event }) => event.successCount,
              currentPhase:  () => 'DECIDED',
            }),
          },
          {
            guard:   'noInfiniteDeliberation',
            target:  'DELIBERATING',
            actions: assign({
              deliberationRounds: ({ context }) => context.deliberationRounds + 1,
            }),
          },
          {
            target:  'DECIDED',
            actions: assign({ currentPhase: () => 'DECIDED' }),
          },
        ],
        DECIDE: {
          target: 'DECIDED',
        },
      },
    },
    DECIDED: {
      type: 'final',
    },
  },
});

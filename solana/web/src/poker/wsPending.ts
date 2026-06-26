// Tipovi za jedan-u-vreme pending WS odgovor (sit, stand, add-chips).
import type { AddChipsWaitResult } from './wsTypes'

export type PendingRequest =
  | {
      kind: 'sit-check'
      seat: number
      buyIn: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'sit'
      seat: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'add-chips-check'
      amount: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'add-chips'
      amount: number
      resolve: (result: AddChipsWaitResult) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'stand'
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }

/** Input to waitFor — explicit union so TS excess-property check works per kind. */
export type PendingRequestInit =
  | { kind: 'sit-check'; seat: number; buyIn: number }
  | { kind: 'sit'; seat: number }
  | { kind: 'add-chips-check'; amount: number }

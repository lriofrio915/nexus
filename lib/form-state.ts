/**
 * Shared result shape for the panel's Server Actions.
 *
 * This lives outside the `'use server'` files on purpose: such a file may only
 * export async functions, so exporting the `IDLE` constant from one throws
 * "A 'use server' file can only export async functions, found object" at
 * runtime — a failure the build does not catch.
 */
export interface SaveState {
  ok: boolean
  message: string
}

export const IDLE: SaveState = { ok: false, message: '' }

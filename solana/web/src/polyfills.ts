/**
 * Mora da se učita pre bilo čega što povlači @solana/* u grafu importa.
 */
import { Buffer } from 'buffer'

globalThis.Buffer = Buffer
;(globalThis as unknown as { global?: typeof globalThis }).global = globalThis

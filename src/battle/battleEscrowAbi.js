/** Minimal ABI for ApconftBattleEscrow (read + settle). */
export const BATTLE_ESCROW_ABI = [
  'function battles(uint256) view returns (address playerA, address playerB, uint256 tokenIdA, uint256 tokenIdB, bool ready, bool settled)',
  'function settle(uint256 battleId, address winner)',
]

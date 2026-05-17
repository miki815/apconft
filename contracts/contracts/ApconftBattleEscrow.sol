// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/// @notice Escrows two Apconft ERC-721s; operator settles and sends both to the winner.
contract ApconftBattleEscrow is ERC721Holder {
    IERC721 public immutable collection;
    address public operator;

    struct Battle {
        address playerA;
        address playerB;
        uint256 tokenIdA;
        uint256 tokenIdB;
        bool ready;
        bool settled;
    }

    mapping(uint256 battleId => Battle) public battles;
    uint256 public nextBattleId;

    event BattleOpened(uint256 indexed battleId, address indexed playerA, uint256 tokenIdA);
    event BattleJoined(uint256 indexed battleId, address indexed playerB, uint256 tokenIdB);
    event BattleSettled(uint256 indexed battleId, address indexed winner, address indexed loser);

    error Unauthorized();
    error InvalidBattle();
    error InvalidWinner();
    error SamePlayer();

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address collection_, address operator_) {
        collection = IERC721(collection_);
        operator = operator_;
    }

    /// @notice Player A creates a battle and escrows their NFT (must approve this contract first).
    function depositPlayerOne(uint256 tokenId) external returns (uint256 battleId) {
        battleId = nextBattleId++;
        Battle storage b = battles[battleId];
        IERC721 col = collection;
        col.safeTransferFrom(msg.sender, address(this), tokenId);
        b.playerA = msg.sender;
        b.tokenIdA = tokenId;
        emit BattleOpened(battleId, msg.sender, tokenId);
    }

    /// @notice Player B joins and escrows their NFT.
    function depositPlayerTwo(uint256 battleId, uint256 tokenId) external {
        Battle storage b = battles[battleId];
        if (b.playerA == address(0)) revert InvalidBattle();
        if (b.playerB != address(0) || b.ready || b.settled) revert InvalidBattle();
        if (msg.sender == b.playerA) revert SamePlayer();

        collection.safeTransferFrom(msg.sender, address(this), tokenId);
        b.playerB = msg.sender;
        b.tokenIdB = tokenId;
        b.ready = true;
        emit BattleJoined(battleId, msg.sender, tokenId);
    }

    /// @notice Operator sends both NFTs to the winner (off-chain randomness decides winner).
    function settle(uint256 battleId, address winner) external onlyOperator {
        Battle storage b = battles[battleId];
        if (!b.ready || b.settled) revert InvalidBattle();
        if (winner != b.playerA && winner != b.playerB) revert InvalidWinner();

        b.settled = true;
        address loser = winner == b.playerA ? b.playerB : b.playerA;

        IERC721 col = collection;
        col.safeTransferFrom(address(this), winner, b.tokenIdA);
        col.safeTransferFrom(address(this), winner, b.tokenIdB);

        emit BattleSettled(battleId, winner, loser);
    }
}

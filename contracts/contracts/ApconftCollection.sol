// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ApconftCollection is ERC721 {
    address private _owner;
    uint256 private _nextTokenId;
    mapping(uint256 tokenId => string) private _tokenURIs;

    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != _owner) revert Unauthorized();
        _;
    }

    constructor() ERC721("Apconft", "ANFT") {
        _owner = msg.sender;
    }

    function mint(address to, string calldata tokenUri) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        // _mint (not _safeMint): _safeMint reverts for many contract wallets that do not implement IERC721Receiver.
        _mint(to, tokenId);
        _tokenURIs[tokenId] = tokenUri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }
}

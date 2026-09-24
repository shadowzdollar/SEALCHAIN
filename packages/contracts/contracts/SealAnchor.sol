// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SealAnchor
/// @notice Append-only registry of Merkle roots. Each root commits to a batch
///         of SealChain document hashes (SHA-256 of the exact issued PDF).
///         Anyone can check a document by recomputing the root from the
///         document hash and its inclusion proof, then calling `anchoredAt`.
/// @dev    The contract stores nothing about the documents themselves — no
///         personal or commercial data ever goes on-chain, only 32-byte roots.
contract SealAnchor {
    address public owner;
    mapping(address => bool) public anchorers;

    /// @notice root => block timestamp at which it was anchored (0 = never).
    mapping(bytes32 => uint64) public anchoredAt;

    /// @notice Number of batches anchored so far.
    uint256 public batchCount;

    event RootAnchored(
        bytes32 indexed root,
        uint256 indexed batchNumber,
        uint32 leafCount,
        string batchId,
        address anchorer
    );
    event AnchorerSet(address indexed account, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotAnchorer();
    error EmptyRoot();
    error AlreadyAnchored(bytes32 root);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        anchorers[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AnchorerSet(msg.sender, true);
    }

    /// @notice Anchor a batch root. Roots are immutable once written.
    function anchor(bytes32 root, uint32 leafCount, string calldata batchId) external {
        if (!anchorers[msg.sender]) revert NotAnchorer();
        if (root == bytes32(0)) revert EmptyRoot();
        if (anchoredAt[root] != 0) revert AlreadyAnchored(root);
        anchoredAt[root] = uint64(block.timestamp);
        unchecked {
            batchCount += 1;
        }
        emit RootAnchored(root, batchCount, leafCount, batchId, msg.sender);
    }

    function setAnchorer(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        anchorers[account] = allowed;
        emit AnchorerSet(account, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

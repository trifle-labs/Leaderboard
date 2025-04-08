# @trifle/leaderboard

An on-chain leaderboard for Solidity, efficiently supporting large data sets using an Augmented Left-Leaning Red-Black (LLRB) Tree.

[![npm version](https://badge.fury.io/js/%40trifle%2Fleaderboard.svg)](https://badge.fury.io/js/%40trifle%2Fleaderboard)

## The Challenge & Solution

On-chain leaderboards are tricky due to gas costs associated with sorting ($O(n²)$ or worse) and storage. This library solves this using an Augmented LLRB tree, providing:

- **Logarithmic Operations:** Inserts, deletes, and ranked lookups are $O(\log n)$, keeping gas costs predictable.
- **Self-Balancing:** Ensures efficient operations without costly manual rebalancing.
- **On-Chain Ranking:** Tree augmentation allows efficient rank queries.
- **FIFO Tie-Breaking:** Unlike earlier implementations, if two entries have the same score, this library prioritizes the entry that was inserted _first_, ensuring fairness based on submission order.

This makes `@trifle/leaderboard` ideal for on-chain games or DeFi applications needing efficient, gas-conscious ranked lists.

## Sorting Order & Ranking

The `Leaderboard` contract can operate in two modes, determined by the `sortAscending` boolean argument passed during deployment:

- **`constructor(true)` (Ascending Order - Default):** Suitable for scenarios where a higher score is better (e.g., points). The highest score gets `rank 0`.
- **`constructor(false)` (Descending Order):** Suitable for scenarios where a lower score is better (e.g., fastest time). The lowest score gets `rank 0`.

**Key Points:**

- **Tie-Breaking (FIFO):** Regardless of the sorting order, if multiple entries have the _same_ score, the entry that was inserted _first_ (First-In) will always have the better rank (First-Out).
- **Index vs. Rank:** It's important to distinguish between retrieving by _index_ and retrieving by _rank_:
  - `getValueAtIndex(i)`, `getOwnerAtIndex(i)`, `getIndexOfOwner(owner)`: These functions operate on the **tree's internal 0-based index**. `index 0` _always_ refers to the leftmost node according to the tree's comparison logic (smallest value if ascending, largest value if descending). `index size-1` is always the rightmost node.
  - `getValueAtRank(r)`, `getOwnerAtRank(r)`, `getRankOfOwner(owner)`: These functions operate on a **0-based rank**, where `rank 0` _always_ represents the **most desirable score** (highest score if ascending, lowest score if descending). `rank size-1` is always the least desirable score.

## Acknowledgements & Prior Work

This implementation builds upon the foundational work of previous on-chain sorted data structures:

- **Rob Hitchens's OrderStatisticsTree:** ([https://github.com/rob-Hitchens/OrderStatisticsTree](https://github.com/rob-Hitchens/OrderStatisticsTree)) - Provided an excellent self-balancing binary search tree with order statistics.
- **BokkyPooBah's RedBlackTreeLibrary:** ([https://github.com/bokkypoobah/BokkyPooBahsRedBlackTreeLibrary](https://github.com/bokkypoobah/BokkyPooBahsRedBlackTreeLibrary)) - An earlier red-black tree implementation.

While these libraries established the core tree structures, `@trifle/leaderboard` introduces a crucial nonce-based mechanism to handle score ties based on insertion order, a feature we needed at [trifle](https://trifle.life).

## Installation

To use this library in your Hardhat or Foundry project, install it via npm or yarn:

```bash
npm install @trifle/leaderboard
# or
yarn add @trifle/leaderboard
```

## Usage

1.  **Import the Contract:**
    Import the `Leaderboard.sol` contract into your Solidity file.

    ```solidity
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.0;

    import "@trifle/leaderboard/contracts/Leaderboard.sol";

    contract YourGameContract is Leaderboard {
        constructor() Leaderboard(true) {} // true for ascending order (points) or false for descending order (fastest time)

        function recordScore(address player, uint256 score) external {
            // Assuming higher score is better
            // The leaderboard contract handles existing player updates internally.
            leaderboard.insert(score, player);
        }

        function getPlayerRank(address player) external view returns (uint256) {
            // Note: Rank might be 0-indexed or 1-indexed depending on how you interpret it.
            // The underlying tree uses 0-based indexing (smallest value at index 0).
            // Check the getRank/getIndexOfOwner functions for specifics.
            require(leaderboard.contains(player), "Player not on leaderboard");
            return leaderboard.getRank(player); // Or getIndexOfOwner depending on desired ranking
        }

        function getTopPlayer() external view returns (address) {
            require(leaderboard.size() > 0, "Leaderboard is empty");
            return leaderboard.getOwnerAtRank(0); // Get owner with the highest rank
        }
    }
    ```

## Development & Testing

This project uses Hardhat.

- Compile contracts: `npx hardhat compile`
- Run tests: `npx hardhat test`
- Run gas benchmark tests: `REPORT_GAS=true npx hardhat test`

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

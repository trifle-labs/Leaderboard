# @trifle/leaderboard

An on-chain leaderboard for Solidity, efficiently supporting large data sets using an Augmented Left-Leaning Red-Black (LLRB) Tree.

[![npm version](https://badge.fury.io/js/%40trifle%2Fleaderboard.svg)](https://badge.fury.io/js/%40trifle%2Fleaderboard)

## The Challenge & Solution

On-chain leaderboards are tricky due to gas costs associated with sorting ($O(n^2)$ or worse) and storage. This library solves this using an Augmented LLRB tree, providing:

- **Logarithmic Operations:** Inserts, deletes, and ranked lookups are $O(\log n)$, keeping gas costs predictable.
- **Self-Balancing:** Ensures efficient operations without costly manual rebalancing.
- **On-Chain Ranking:** Tree augmentation allows efficient rank queries.
- **FIFO Tie-Breaking:** If two entries have the same score, this library prioritizes the entry that was inserted _first_ (lower nonce), ensuring fairness based on submission order.
- **Embedded Library:** Uses only `internal` functions, meaning the library code is embedded directly into your contract. **No separate deployment of the library is required.**
- **Multiple Leaderboards:** Easily manage multiple independent leaderboards within a single contract.

This makes `@trifle/leaderboard` ideal for on-chain games or DeFi applications needing efficient, gas-conscious ranked lists.

## Sorting Order & Ranking

The `Leaderboard` library operates on a `Leaderboard.s` storage struct within your contract. You initialize each struct instance by calling its `init` function, specifying the desired sorting order with the `sortAscending` boolean argument:

- **`init(true)` (Ascending Order):** Suitable for scenarios where a higher score is better (e.g., points). The highest score gets `rank 0`.
- **`init(false)` (Descending Order):** Suitable for scenarios where a lower score is better (e.g., fastest time). The lowest score gets `rank 0`.

**Key Points:**

- **Tie-Breaking (FIFO):** Regardless of the sorting order, if multiple entries have the _same_ score, the entry that was inserted _first_ (lower nonce) will always have the better rank.
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

1.  **Import the Library:**
    Import `Leaderboard.sol` into your Solidity file.
2.  **Use the Library:**
    Apply the library to its storage struct `Leaderboard.s`.
3.  **Declare Storage:**
    Declare one or more variables of type `Leaderboard.s` in your contract's storage.
4.  **Initialize:**
    Call the `init` function on each storage variable, likely in your constructor or an initializer function.
5.  **Call Functions:**
    Use the library functions directly on your storage variable.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@trifle/leaderboard/contracts/Leaderboard.sol";

contract YourGameContract {
    // Apply the library's functions to the Leaderboard.s struct
    using Leaderboard for Leaderboard.s;

    // Declare storage variables for one or more leaderboards
    Leaderboard.s public highScores; // Ascending order (higher score is better)
    Leaderboard.s public fastestTimes; // Descending order (lower time is better)

    // Prevent multiple initializations (if using an initializer pattern)
    bool private _initialized;

    event Initialized(uint8 version);

    // Use constructor or an initializer
    constructor() {
        _initialize();
    }

    function initialize() external {
        // Example initializer pattern
        require(!_initialized, "Already initialized");
        _initialize();
    }

    function _initialize() private {
        require(!_initialized, "Already initialized");
        // Initialize each leaderboard instance
        highScores.init(true);  // true = ascending (high score wins)
        fastestTimes.init(false); // false = descending (low time wins)
        _initialized = true;
        emit Initialized(1);
    }

    function recordHighScore(address player, uint256 score) external {
        // Handles inserting or updating the player's score
        highScores.insert(score, player);
    }

    function recordFastestTime(address player, uint256 time) external {
        fastestTimes.insert(time, player);
    }

    function getPlayerRankHighScore(address player) external view returns (uint256) {
        require(highScores.contains(player), "Player not on high score leaderboard");
        // Rank 0 is the highest score
        return highScores.getRankOfOwner(player);
    }

     function getPlayerRankFastestTime(address player) external view returns (uint256) {
        require(fastestTimes.contains(player), "Player not on fastest time leaderboard");
        // Rank 0 is the lowest time
        return fastestTimes.getRankOfOwner(player);
    }

    function getTopPlayerHighScore() external view returns (address) {
        require(highScores.size() > 0, "High score leaderboard is empty");
        // Rank 0 is the highest score
        return highScores.getOwnerAtRank(0);
    }

     function getTopPlayerFastestTime() external view returns (address) {
        require(fastestTimes.size() > 0, "Fastest time leaderboard is empty");
        // Rank 0 is the lowest time
        return fastestTimes.getOwnerAtRank(0);
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

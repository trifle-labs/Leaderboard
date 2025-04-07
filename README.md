# @trifle/leaderboard

A highly efficient, gas-optimized on-chain leaderboard for Solidity, using an Augmented Left-Leaning Red-Black (LLRB) Tree.

[![npm version](https://badge.fury.io/js/%40trifle%2Fleaderboard.svg)](https://badge.fury.io/js/%40trifle%2Fleaderboard)

## The Challenge & Solution

On-chain leaderboards are tricky due to gas costs associated with sorting (\\(O(n \\log n)\\) or worse) and storage. This library solves this using an Augmented LLRB tree, providing:

- **Logarithmic Operations:** Inserts, deletes, and ranked lookups are \\(O(\log n)\\), keeping gas costs predictable.
- **Self-Balancing:** Ensures efficient operations without costly manual rebalancing.
- **On-Chain Ranking:** Tree augmentation allows efficient rank queries.
- **Timestamped Tie-Breaking:** Unlike earlier implementations, if two entries have the same score, this library prioritizes the entry that was inserted _first_, ensuring fairness based on submission time.

This makes `@trifle/leaderboard` ideal for on-chain games or DeFi applications needing efficient, gas-conscious ranked lists.

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

    contract YourGameContract {
        Leaderboard public leaderboard;

        constructor(address _leaderboardAddress) {
            leaderboard = Leaderboard(_leaderboardAddress);
        }

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

2.  **Deployment:**
    You will need to deploy the `Leaderboard.sol` contract separately or link it as a library if you adapt the code structure. Pass the deployed address of the `Leaderboard` contract to the constructor of your contract that uses it.

3.  **Interacting (JavaScript/TypeScript with Hardhat/Ethers.js):**

    ```javascript
    const { ethers } = require('hardhat');
    const leaderboardArtifact = require('@trifle/leaderboard/artifacts/contracts/Leaderboard.sol/Leaderboard.json');

    async function main() {
      const leaderboardAddress = '0x...'; // Replace with deployed Leaderboard address
      const leaderboard = await ethers.getContractAt(
        leaderboardArtifact.abi,
        leaderboardAddress
      );

      // Insert a score
      const player = '0xPLAYER_ADDRESS';
      const score = 12345;
      const tx = await leaderboard.insert(score, player);
      await tx.wait();
      console.log(`Inserted score ${score} for player ${player}`);

      // Get leaderboard size
      const size = await leaderboard.size();
      console.log('Leaderboard size:', size.toString());

      // Get value by index (0 = smallest score)
      if (size > 0) {
        const valueAtIndex0 = await leaderboard.getValueAtIndex(0);
        console.log('Value at index 0:', valueAtIndex0.toString());
      }

      // Get player's value
      const playerValue = await leaderboard.getValue(player);
      console.log(`Player ${player}'s value:`, playerValue.toString());
    }

    main().catch(console.error);
    ```

## Development & Testing

This project uses Hardhat.

- Compile contracts: `npx hardhat compile`
- Run tests: `npx hardhat test`
- Run gas benchmark tests: `REPORT_GAS=true npx hardhat test`

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

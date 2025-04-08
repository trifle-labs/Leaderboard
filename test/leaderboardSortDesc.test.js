const { expect } = require('chai');
const hre = require('hardhat');
const { before, describe, it } = require('mocha');

const ethers = hre.ethers;

describe('Leaderboard (Descending Sort - Higher Value = Left)', function () {
  this.timeout(500_000);

  let leaderboard;
  let accounts;
  let leaderboardFactory;
  const SORT_ASCENDING = false; // Explicitly set for clarity in tests

  before(async function () {
    accounts = await ethers.getSigners();
    leaderboardFactory = await ethers.getContractFactory('LeaderboardTest');
    leaderboard = await leaderboardFactory.deploy(SORT_ASCENDING);
    await leaderboard.waitForDeployment();
  });

  async function resetLeaderboard() {
    leaderboard = await leaderboardFactory.deploy(SORT_ASCENDING);
    await leaderboard.waitForDeployment();
  }

  describe('Basic Operations (Descending)', function () {
    beforeEach(resetLeaderboard);

    it('should start with an empty leaderboard', async function () {
      const size = await leaderboard.size();
      expect(size).to.equal(0);
    });

    it('should insert and retrieve values correctly (highest value = index 0)', async function () {
      await leaderboard.insert(100, accounts[1].address); // Insert a score

      const size = await leaderboard.size();
      expect(size).to.equal(1);

      // Index 0 has the only value (which is the 'highest' according to tree logic)
      const value = await leaderboard.getValueAtIndex(0);
      expect(value).to.equal(100);

      const owner = await leaderboard.getOwnerAtIndex(0);
      expect(owner).to.equal(accounts[1].address);

      const ownerValue = await leaderboard.getValue(accounts[1].address);
      expect(ownerValue).to.equal(100);
    });

    it('should handle multiple insertions, highest score at lowest index', async function () {
      await leaderboard.insert(100, accounts[1].address); // Low score (best time)
      await leaderboard.insert(200, accounts[2].address); // Medium score
      await leaderboard.insert(300, accounts[3].address); // High score (worst time)

      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order (highest score at lowest index)
      expect(await leaderboard.getValueAtIndex(0)).to.equal(300); // Worst time is index 0
      expect(await leaderboard.getValueAtIndex(1)).to.equal(200);
      expect(await leaderboard.getValueAtIndex(2)).to.equal(100); // Best time is index 2 (size - 1)

      // Check owners
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[3].address
      );
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[2].address
      );
      expect(await leaderboard.getOwnerAtIndex(2)).to.equal(
        accounts[1].address
      );
    });

    it('should handle insertions in reverse order, highest score still at lowest index', async function () {
      await leaderboard.insert(300, accounts[1].address); // High score (worst time)
      await leaderboard.insert(200, accounts[2].address); // Medium score
      await leaderboard.insert(100, accounts[3].address); // Low score (best time)

      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order (highest score at lowest index)
      expect(await leaderboard.getValueAtIndex(0)).to.equal(300);
      expect(await leaderboard.getValueAtIndex(1)).to.equal(200);
      expect(await leaderboard.getValueAtIndex(2)).to.equal(100);

      // Check owners
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[1].address
      );
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[2].address
      );
      expect(await leaderboard.getOwnerAtIndex(2)).to.equal(
        accounts[3].address
      );
    });

    it('should handle multiple insertions in random order', async function () {
      await leaderboard.insert(200, accounts[1].address);
      await leaderboard.insert(100, accounts[2].address); // Best time
      await leaderboard.insert(300, accounts[3].address); // Worst time

      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order
      expect(await leaderboard.getValueAtIndex(0)).to.equal(300);
      expect(await leaderboard.getValueAtIndex(1)).to.equal(200);
      expect(await leaderboard.getValueAtIndex(2)).to.equal(100);

      // Check owners
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[3].address
      );
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[1].address
      );
      expect(await leaderboard.getOwnerAtIndex(2)).to.equal(
        accounts[2].address
      );
    });

    it('should handle removal correctly', async function () {
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(200, accounts[2].address);
      await leaderboard.insert(300, accounts[3].address);

      // Remove middle value (score 200)
      await leaderboard.remove(accounts[2].address);

      const size = await leaderboard.size();
      expect(size).to.equal(2);

      // Check remaining values (300 at index 0, 100 at index 1)
      expect(await leaderboard.getValueAtIndex(0)).to.equal(300);
      expect(await leaderboard.getValueAtIndex(1)).to.equal(100);

      // Check remaining owners
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[3].address
      );
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[1].address
      );

      await expect(
        leaderboard.getValue(accounts[2].address)
      ).to.be.revertedWith('Owner does not exist in the leaderboard');
    });

    it('should handle replacing an existing entry with a different score', async function () {
      await leaderboard.insert(100, accounts[1].address); // Initial score
      await leaderboard.insert(50, accounts[2].address); // Best score overall

      // Replace acc[1] with a worse score (higher value)
      await leaderboard.insert(150, accounts[1].address);

      const size = await leaderboard.size();
      expect(size).to.equal(2);

      // Check values - 150 should be index 0, 50 should be index 1
      expect(await leaderboard.getValueAtIndex(0)).to.equal(150);
      expect(await leaderboard.getValueAtIndex(1)).to.equal(50);

      // Check owners
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[1].address
      );
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[2].address
      );

      expect(await leaderboard.getValue(accounts[1].address)).to.equal(150);
      expect(await leaderboard.getValue(accounts[2].address)).to.equal(50);
    });
  });

  describe('Tie-Breaking Logic (Descending - Higher Value = Left, FIFO)', function () {
    beforeEach(resetLeaderboard);

    it('should place first inserted score first within its score group', async function () {
      // Insert same score (100) sequentially: acc[1], acc[2], acc[3]
      // Insert a different score (50) for context
      await leaderboard.insert(50, accounts[0].address); // Best time overall
      await leaderboard.insert(100, accounts[1].address); // First 100
      await leaderboard.insert(100, accounts[2].address); // Second 100
      await leaderboard.insert(100, accounts[3].address); // Third 100
      await leaderboard.insert(150, accounts[4].address); // Worst time overall

      const size = await leaderboard.size();
      expect(size).to.equal(5);

      // Verify overall order (highest value first)
      expect(await leaderboard.getValueAtRank(0)).to.equal(50);
      expect(await leaderboard.getValueAtRank(1)).to.equal(100);
      expect(await leaderboard.getValueAtRank(2)).to.equal(100);
      expect(await leaderboard.getValueAtRank(3)).to.equal(100);
      expect(await leaderboard.getValueAtRank(4)).to.equal(150);

      // Verify FIFO within the score 100 group (Indices 1, 2, 3)
      // acc[1] was first -> should appear first in the 100s block
      expect(await leaderboard.getOwnerAtRank(1)).to.equal(accounts[1].address);
      expect(await leaderboard.getOwnerAtRank(2)).to.equal(accounts[2].address);
      expect(await leaderboard.getOwnerAtRank(3)).to.equal(accounts[3].address);

      // Verify index lookups
      expect(await leaderboard.getRankOfOwner(accounts[4].address)).to.equal(4); // Score 150
      expect(await leaderboard.getRankOfOwner(accounts[1].address)).to.equal(1); // First 100
      expect(await leaderboard.getRankOfOwner(accounts[2].address)).to.equal(2); // Second 100
      expect(await leaderboard.getRankOfOwner(accounts[3].address)).to.equal(3); // Third 100
      expect(await leaderboard.getRankOfOwner(accounts[0].address)).to.equal(0); // Score 50
    });

    it('should maintain FIFO tie-breaking after removal and insertion', async function () {
      await leaderboard.insert(100, accounts[1].address); // First 100
      await leaderboard.insert(100, accounts[2].address); // Second 100
      await leaderboard.insert(50, accounts[0].address); // Best score

      // Initial state: Indices: 0: acc[1](100), 1: acc[2](100), 2: acc[0](50)
      expect(await leaderboard.getOwnerAtRank(0)).to.equal(accounts[0].address);
      expect(await leaderboard.getOwnerAtRank(1)).to.equal(accounts[1].address);
      expect(await leaderboard.getOwnerAtRank(2)).to.equal(accounts[2].address);
      expect(await leaderboard.getRankOfOwner(accounts[1].address)).to.equal(1);
      expect(await leaderboard.getRankOfOwner(accounts[2].address)).to.equal(2);
      expect(await leaderboard.getRankOfOwner(accounts[0].address)).to.equal(0);

      // Remove the first entry (acc[1])
      await leaderboard.remove(accounts[1].address);

      // State: Indices: 0: acc[2](100), 1: acc[0](50)
      expect(await leaderboard.size()).to.equal(2);
      expect(await leaderboard.getOwnerAtRank(0)).to.equal(accounts[0].address);
      expect(await leaderboard.getOwnerAtRank(1)).to.equal(accounts[2].address);
      expect(await leaderboard.getRankOfOwner(accounts[2].address)).to.equal(1);
      expect(await leaderboard.getRankOfOwner(accounts[0].address)).to.equal(0);

      // Insert a new entry (acc[3]) with score 100
      await leaderboard.insert(100, accounts[3].address);

      // State: Indices: 0: acc[3](100), 1: acc[2](100), 2: acc[0](50)
      // acc[2] precedes acc[3] in rank because it was inserted earlier *with score 100*
      expect(await leaderboard.size()).to.equal(3);
      expect(await leaderboard.getOwnerAtRank(0)).to.equal(accounts[0].address);
      expect(await leaderboard.getOwnerAtRank(1)).to.equal(accounts[2].address);
      expect(await leaderboard.getOwnerAtRank(2)).to.equal(accounts[3].address);
      expect(await leaderboard.getRankOfOwner(accounts[2].address)).to.equal(1);
      expect(await leaderboard.getRankOfOwner(accounts[3].address)).to.equal(2);
      expect(await leaderboard.getRankOfOwner(accounts[0].address)).to.equal(0);

      // Re-insert acc[1] with score 100. It's now the newest entry with score 100.
      await leaderboard.insert(100, accounts[1].address);

      // State: Indices: 0: acc[1](100), 1: acc[3](100), 2: acc[2](100), 3: acc[0](50)
      expect(await leaderboard.size()).to.equal(4);
      expect(await leaderboard.getOwnerAtRank(0)).to.equal(accounts[0].address);
      expect(await leaderboard.getOwnerAtRank(1)).to.equal(accounts[2].address);
      expect(await leaderboard.getOwnerAtRank(2)).to.equal(accounts[3].address);
      expect(await leaderboard.getOwnerAtRank(3)).to.equal(accounts[1].address);
      expect(await leaderboard.getRankOfOwner(accounts[2].address)).to.equal(1);
      expect(await leaderboard.getRankOfOwner(accounts[3].address)).to.equal(2);
      expect(await leaderboard.getRankOfOwner(accounts[1].address)).to.equal(3);
      expect(await leaderboard.getRankOfOwner(accounts[0].address)).to.equal(0);
    });
  });
});

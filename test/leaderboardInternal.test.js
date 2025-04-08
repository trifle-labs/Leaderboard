const { expect } = require('chai');
const hre = require('hardhat');
const { before, describe, it } = require('mocha');

const ethers = hre.ethers;

describe('Leaderboard (Internal Implementation)', function () {
  this.timeout(500_000);

  let leaderboard;
  let accounts;

  before(async function () {
    accounts = await ethers.getSigners();

    // Deploy the contract
    const leaderboardFactory = await ethers.getContractFactory(
      'LeaderboardTest'
    );
    leaderboard = await leaderboardFactory.deploy(true);
    await leaderboard.waitForDeployment();
  });

  describe('Tree Properties and Invariants', function () {
    it('should maintain black root property', async function () {
      // Insert a few values
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(50, accounts[2].address);
      await leaderboard.insert(150, accounts[3].address);

      // Check if leaderboard is valid
      const isValid = await leaderboard._testIsValidTree();
      expect(isValid).to.be.true;
    });

    it('should handle node balancing with left-leaning property', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values in increasing order (would create right-leaning leaderboard without balancing)
      for (let i = 0; i < 10; i++) {
        await leaderboard.insert(i * 10, accounts[i + 1].address);
      }

      // Verify leaderboard is valid
      const isValid = await leaderboard._testIsValidTree();
      expect(isValid).to.be.true;

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(10);
    });

    it('should handle node balancing with decreasing values', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values in decreasing order (would create left-leaning leaderboard without balancing)
      for (let i = 10; i > 0; i--) {
        await leaderboard.insert(i * 10, accounts[i].address);
      }

      // Verify leaderboard is valid
      const isValid = await leaderboard._testIsValidTree();
      expect(isValid).to.be.true;

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(10);
    });
  });

  describe('Node Indices and Ordering', function () {
    it('should maintain correct indices after insertions and removals', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert some values
      await leaderboard.insert(30, accounts[1].address);
      await leaderboard.insert(20, accounts[2].address);
      await leaderboard.insert(40, accounts[3].address);
      await leaderboard.insert(10, accounts[4].address);

      // Check indices before removal
      expect(await leaderboard.getIndexOfOwner(accounts[4].address)).to.equal(
        0
      ); // Value 10
      expect(await leaderboard.getIndexOfOwner(accounts[2].address)).to.equal(
        1
      ); // Value 20
      expect(await leaderboard.getIndexOfOwner(accounts[1].address)).to.equal(
        2
      ); // Value 30
      expect(await leaderboard.getIndexOfOwner(accounts[3].address)).to.equal(
        3
      ); // Value 40

      // Remove a node in the middle
      await leaderboard.remove(accounts[2].address); // Value 20

      // Check indices after removal
      expect(await leaderboard.getIndexOfOwner(accounts[4].address)).to.equal(
        0
      ); // Value 10
      expect(await leaderboard.getIndexOfOwner(accounts[1].address)).to.equal(
        1
      ); // Value 30
      expect(await leaderboard.getIndexOfOwner(accounts[3].address)).to.equal(
        2
      ); // Value 40

      // Insert a new value
      await leaderboard.insert(25, accounts[5].address);

      // Check indices after insertion
      expect(await leaderboard.getIndexOfOwner(accounts[4].address)).to.equal(
        0
      ); // Value 10
      expect(await leaderboard.getIndexOfOwner(accounts[5].address)).to.equal(
        1
      ); // Value 25
      expect(await leaderboard.getIndexOfOwner(accounts[1].address)).to.equal(
        2
      ); // Value 30
      expect(await leaderboard.getIndexOfOwner(accounts[3].address)).to.equal(
        3
      ); // Value 40
    });

    it('should maintain correct nonces and tie-breaking order', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert same value with different nonces (automatically assigned)
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(100, accounts[2].address);
      await leaderboard.insert(100, accounts[3].address);

      // Check order (older nonce at highest index)
      expect(await leaderboard.getIndexOfOwner(accounts[1].address)).to.equal(
        2
      ); // Oldest (lowest nonce)
      expect(await leaderboard.getIndexOfOwner(accounts[2].address)).to.equal(
        1
      ); // Middle
      expect(await leaderboard.getIndexOfOwner(accounts[3].address)).to.equal(
        0
      ); // Newest (highest nonce)

      // Check values by index
      expect(await leaderboard.getOwnerAtIndex(0)).to.equal(
        accounts[3].address
      ); // Newest at lowest index
      expect(await leaderboard.getOwnerAtIndex(1)).to.equal(
        accounts[2].address
      );
      expect(await leaderboard.getOwnerAtIndex(2)).to.equal(
        accounts[1].address
      ); // Oldest at highest index

      // Verify nonces are stored correctly
      const nonce1 = await leaderboard.getNonce(accounts[1].address);
      const nonce2 = await leaderboard.getNonce(accounts[2].address);
      const nonce3 = await leaderboard.getNonce(accounts[3].address);

      expect(nonce1).to.be.lessThan(nonce2);
      expect(nonce2).to.be.lessThan(nonce3);
    });
  });

  describe('Size and Cleanup Handling', function () {
    it('should clean up owner nonces when removing nodes', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert a node
      await leaderboard.insert(100, accounts[1].address);

      // Verify nonce exists
      await leaderboard.getNonce(accounts[1].address);

      // Remove the node
      await leaderboard.remove(accounts[1].address);

      // Verify nonce is cleaned up
      await expect(
        leaderboard.getNonce(accounts[1].address)
      ).to.be.revertedWith('Owner does not exist in the leaderboard');
    });

    it('should update owner mapping when replacing a node', async function () {
      // Reset the leaderboard
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert initial value
      await leaderboard.insert(100, accounts[1].address);

      // Get initial nonce
      const initialNonce = await leaderboard.getNonce(accounts[1].address);

      // Replace with new value
      await leaderboard.insert(200, accounts[1].address);

      // Get new nonce
      const newNonce = await leaderboard.getNonce(accounts[1].address);

      // New nonce should be greater than initial
      expect(newNonce).to.be.greaterThan(initialNonce);

      // Value should be updated
      const value = await leaderboard.getValue(accounts[1].address);
      expect(value).to.equal(200);
    });
  });
});

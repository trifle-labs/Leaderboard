const { expect } = require('chai');
const hre = require('hardhat');
const { before, describe, it } = require('mocha');

const ethers = hre.ethers;

describe('LeaderboardTest', function () {
  this.timeout(500_000); // Extended timeout for large tree tests

  let leaderboard;
  let accounts;
  let leaderboardFactory;
  let snapshot;

  before(async function () {
    // Get test accounts
    accounts = await ethers.getSigners();

    // Deploy the contract
    leaderboardFactory = await ethers.getContractFactory('LeaderboardTest');
    leaderboard = await leaderboardFactory.deploy(true);
    await leaderboard.waitForDeployment();

    const isInitialized = await leaderboard.isInitialized();
    expect(isInitialized).to.equal(true);

    snapshot = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async function () {
    await ethers.provider.send('evm_revert', [snapshot]);
  });

  describe('Basic Operations', function () {
    it('should start with an empty leaderboard', async function () {
      const size = await leaderboard.size();
      expect(size).to.equal(0);
    });

    it('should insert and retrieve values correctly', async function () {
      await leaderboard.insert(100, accounts[1].address);

      const size = await leaderboard.size();
      expect(size).to.equal(1);

      const value = await leaderboard.getValueAtIndex(0);
      expect(value).to.equal(100);

      const owner = await leaderboard.getOwnerAtIndex(0);
      expect(owner).to.equal(accounts[1].address);

      const ownerValue = await leaderboard.getValue(accounts[1].address);
      expect(ownerValue).to.equal(100);
    });

    it('should handle multiple insertions in ascending order', async function () {
      // Reset by redeploying
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values in increasing order
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(200, accounts[2].address);
      await leaderboard.insert(300, accounts[3].address);

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order
      const value1 = await leaderboard.getValueAtIndex(0);
      const value2 = await leaderboard.getValueAtIndex(1);
      const value3 = await leaderboard.getValueAtIndex(2);

      expect(value1).to.equal(100);
      expect(value2).to.equal(200);
      expect(value3).to.equal(300);

      // Check owners
      const owner1 = await leaderboard.getOwnerAtIndex(0);
      const owner2 = await leaderboard.getOwnerAtIndex(1);
      const owner3 = await leaderboard.getOwnerAtIndex(2);

      expect(owner1).to.equal(accounts[1].address);
      expect(owner2).to.equal(accounts[2].address);
      expect(owner3).to.equal(accounts[3].address);
    });

    it('should handle multiple insertions in descending order', async function () {
      // Reset
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values in decreasing order
      await leaderboard.insert(300, accounts[1].address);
      await leaderboard.insert(200, accounts[2].address);
      await leaderboard.insert(100, accounts[3].address);

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order (should still be sorted in ascending order)
      const value1 = await leaderboard.getValueAtIndex(0);
      const value2 = await leaderboard.getValueAtIndex(1);
      const value3 = await leaderboard.getValueAtIndex(2);

      expect(value1).to.equal(100);
      expect(value2).to.equal(200);
      expect(value3).to.equal(300);

      // Check owners (order should be reversed from insertion order)
      const owner1 = await leaderboard.getOwnerAtIndex(0);
      const owner2 = await leaderboard.getOwnerAtIndex(1);
      const owner3 = await leaderboard.getOwnerAtIndex(2);

      expect(owner1).to.equal(accounts[3].address);
      expect(owner2).to.equal(accounts[2].address);
      expect(owner3).to.equal(accounts[1].address);
    });

    it('should handle multiple insertions in random order', async function () {
      // Reset
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values in random order
      await leaderboard.insert(200, accounts[1].address);
      await leaderboard.insert(100, accounts[2].address);
      await leaderboard.insert(300, accounts[3].address);

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order
      const value1 = await leaderboard.getValueAtIndex(0);
      const value2 = await leaderboard.getValueAtIndex(1);
      const value3 = await leaderboard.getValueAtIndex(2);

      expect(value1).to.equal(100);
      expect(value2).to.equal(200);
      expect(value3).to.equal(300);

      // Check owners
      const owner1 = await leaderboard.getOwnerAtIndex(0);
      const owner2 = await leaderboard.getOwnerAtIndex(1);
      const owner3 = await leaderboard.getOwnerAtIndex(2);

      expect(owner1).to.equal(accounts[2].address);
      expect(owner2).to.equal(accounts[1].address);
      expect(owner3).to.equal(accounts[3].address);
    });

    it('should handle removal correctly', async function () {
      // Reset
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert values
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(200, accounts[2].address);
      await leaderboard.insert(300, accounts[3].address);

      // Remove middle value
      await leaderboard.remove(accounts[2].address);

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(2);

      // Check remaining values
      const value1 = await leaderboard.getValueAtIndex(0);
      const value2 = await leaderboard.getValueAtIndex(1);

      expect(value1).to.equal(100);
      expect(value2).to.equal(300);

      // Check remaining owners
      const owner1 = await leaderboard.getOwnerAtIndex(0);
      const owner2 = await leaderboard.getOwnerAtIndex(1);

      expect(owner1).to.equal(accounts[1].address);
      expect(owner2).to.equal(accounts[3].address);

      // Verify the removed address is truly gone
      await expect(
        leaderboard.getValue(accounts[2].address)
      ).to.be.revertedWith('Owner does not exist in the leaderboard');
    });

    it('should handle replacing an existing address entry', async function () {
      // Reset
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert initial value
      await leaderboard.insert(100, accounts[1].address);

      // Replace with new value
      await leaderboard.insert(200, accounts[1].address);

      // Check size (should still be 1)
      const size = await leaderboard.size();
      expect(size).to.equal(1);

      // Check updated value
      const value = await leaderboard.getValueAtIndex(0);
      expect(value).to.equal(200);

      const ownerValue = await leaderboard.getValue(accounts[1].address);
      expect(ownerValue).to.equal(200);
    });
  });

  describe('Tie-Breaking Logic', function () {
    it('should handle same values with older nodes having higher indices', async function () {
      // Reset
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert same value for different accounts (will get automatically assigned increasing nonces)
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(100, accounts[2].address);
      await leaderboard.insert(100, accounts[3].address);

      // Check size
      const size = await leaderboard.size();
      expect(size).to.equal(3);

      // Check order by nonce (oldest first - highest index)
      const owner1 = await leaderboard.getOwnerAtIndex(0);
      const owner2 = await leaderboard.getOwnerAtIndex(1);
      const owner3 = await leaderboard.getOwnerAtIndex(2);

      expect(owner3).to.equal(accounts[1].address); // Oldest entry at highest index
      expect(owner2).to.equal(accounts[2].address); // Middle entry
      expect(owner1).to.equal(accounts[3].address); // Newest entry at lowest index

      // Verify we can get correct indices
      const index1 = await leaderboard.getIndexOfOwner(accounts[1].address);
      const index2 = await leaderboard.getIndexOfOwner(accounts[2].address);
      const index3 = await leaderboard.getIndexOfOwner(accounts[3].address);

      expect(index1).to.equal(2); // Oldest at highest index
      expect(index2).to.equal(1);
      expect(index3).to.equal(0); // Newest at lowest index
    });
  });

  describe('Scale Tests', function () {
    // Helper function to create a large leaderboard
    async function createLargeLeaderboard(numNodes, pattern) {
      // Reset
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      const newLeaderboard = await leaderboardFactory.deploy(true);
      await newLeaderboard.waitForDeployment();
      leaderboard = newLeaderboard;

      const addresses = [];
      // Generate unique addresses using random wallets
      for (let i = 0; i < numNodes; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        addresses.push(wallet.address);
      }

      // Insert values based on pattern
      for (let i = 0; i < numNodes; i++) {
        let value;
        switch (pattern) {
          case 'ascending':
            value = i + 1;
            break;
          case 'descending':
            value = numNodes - i;
            break;
          case 'random':
            value = Math.floor(Math.random() * numNodes) + 1;
            break;
          default:
            value = i + 1;
        }
        // Fund the wallet before inserting if using real network or fork
        // await ethers.provider.send('hardhat_setBalance', [addresses[i], '0x10000000000000000']);
        await leaderboard.insert(value, addresses[i]);
      }

      return addresses;
    }

    // Reference array implementation to verify tree behavior
    function getExpectedSortedArray(addresses, values) {
      // Create array of [address, value, nonce] entries
      const entries = addresses.map((addr, i) => ({
        address: addr,
        value: values[i],
        nonce: i, // We use the index as a proxy for nonce (lower = older)
      }));

      // Sort by value, then by nonce (older/lower nonce gets higher index)
      return entries.sort((a, b) => {
        if (a.value !== b.value) {
          return a.value - b.value; // Sort by value first
        }
        return b.nonce - a.nonce; // Then by nonce (decreasing)
      });
    }

    it('should handle 1,000 nodes with increasing values', async function () {
      const numNodes = 1000;
      const addresses = await createLargeLeaderboard(numNodes, 'ascending');

      // Verify size
      const size = await leaderboard.size();
      expect(size).to.equal(numNodes);

      // Check a few random indices to ensure proper sorting
      const indices = [0, 250, 500, 750, 999];
      for (const idx of indices) {
        const value = await leaderboard.getValueAtIndex(idx);
        expect(value).to.equal(idx + 1);
      }

      // Verify a few random removals
      await leaderboard.remove(addresses[500]);
      await leaderboard.remove(addresses[750]);
      await leaderboard.remove(addresses[250]);

      const newSize = await leaderboard.size();
      expect(newSize).to.equal(numNodes - 3);
    });

    it('should handle 1,000 nodes with decreasing values', async function () {
      const numNodes = 1000;
      const addresses = await createLargeLeaderboard(numNodes, 'descending');

      // Verify size
      const size = await leaderboard.size();
      expect(size).to.equal(numNodes);

      // Check a few random indices to ensure proper sorting
      const indices = [0, 250, 500, 750, 999];
      for (const idx of indices) {
        const value = await leaderboard.getValueAtIndex(idx);
        expect(value).to.equal(idx + 1);
      }

      // Verify a few random removals
      await leaderboard.remove(addresses[300]);
      await leaderboard.remove(addresses[600]);
      await leaderboard.remove(addresses[900]);

      const newSize = await leaderboard.size();
      expect(newSize).to.equal(numNodes - 3);
    });

    it('should handle 1,000 nodes with random values', async function () {
      const numNodes = 1000;
      const addresses = await createLargeLeaderboard(numNodes, 'random');

      // Verify size
      const size = await leaderboard.size();
      expect(size).to.equal(numNodes);

      // Check that values are sorted in ascending order
      let prevValue = await leaderboard.getValueAtIndex(0);

      // Check sequential indices to ensure proper sorting
      for (let i = 1; i < 10; i++) {
        const value = await leaderboard.getValueAtIndex(i);
        expect(value).to.be.at.least(prevValue);
        prevValue = value;
      }

      // Verify a few random removals
      await leaderboard.remove(addresses[Math.floor(Math.random() * numNodes)]);
      await leaderboard.remove(addresses[Math.floor(Math.random() * numNodes)]);
      await leaderboard.remove(addresses[Math.floor(Math.random() * numNodes)]);

      const newSize = await leaderboard.size();
      expect(newSize).to.be.at.most(numNodes - 1);
    });
  });

  describe('Internal Implementation Tests', function () {
    it('should maintain LLRB tree properties', async function () {
      // Reset
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert some values
      for (let i = 0; i < 20; i++) {
        await leaderboard.insert(i * 10, accounts[1 + (i % 9)].address);
      }

      // Check if tree is valid
      const isValid = await leaderboard._testIsValidTree();
      expect(isValid).to.be.true;
    });

    it('should correctly maintain size property', async function () {
      // Reset
      const leaderboardFactory = await ethers.getContractFactory(
        'LeaderboardTest'
      );
      leaderboard = await leaderboardFactory.deploy(true);
      await leaderboard.waitForDeployment();

      // Insert and remove values while checking size
      await leaderboard.insert(100, accounts[1].address);
      await leaderboard.insert(200, accounts[2].address);
      await leaderboard.insert(300, accounts[3].address);

      let size = await leaderboard.size();
      expect(size).to.equal(3);

      await leaderboard.remove(accounts[2].address);
      size = await leaderboard.size();
      expect(size).to.equal(2);

      await leaderboard.insert(400, accounts[4].address);
      size = await leaderboard.size();
      expect(size).to.equal(3);

      // Test replacing an existing value
      await leaderboard.insert(500, accounts[1].address);
      size = await leaderboard.size();
      expect(size).to.equal(3);
    });
  });
});

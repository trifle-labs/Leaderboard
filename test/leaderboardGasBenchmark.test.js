const { expect } = require('chai');
const hre = require('hardhat');
const { before, describe, it } = require('mocha');

const ethers = hre.ethers;

const hardhatEthers = hre.ethers;

describe('Leaderboard Gas Benchmark', function () {
  let leaderboardFactory;
  let leaderboard;
  let deployer;

  // Track gas usage
  const gasUsed = {
    insert: {},
    remove: {},
    // View function gas measurements to be implemented in the future
    // getValueAtIndex: {},
    // getOwnerAtIndex: {},
  };

  // Define leaderboard sizes to test - reducing the max size for quicker testing
  const treeSizes = [10, 50, 100, 200, 500, 1000]; // Removed 2000 and 5000 for faster testing

  // Generate test addresses and values
  const testAddresses = [];
  const testValues = [];

  before(async function () {
    // Get deployer account
    [deployer] = await hardhatEthers.getSigners();

    // Store the factory for later deployments
    leaderboardFactory = await hardhatEthers.getContractFactory('Leaderboard');

    // Pre-generate test addresses - using a more compatible approach
    console.log('Generating test data...');
    for (let i = 0; i < 5100; i++) {
      // Create a deterministic address using ethers
      const encoder = new ethers.AbiCoder();
      const addressData = ethers.keccak256(
        encoder.encode(['string', 'uint256'], ['address', i])
      );
      // Format as an Ethereum address
      const address = ethers.getAddress('0x' + addressData.slice(26));
      testAddresses.push(address);
      testValues.push(i * 10); // Spaced out values
    }
  });

  // Function to build a leaderboard with n elements
  async function buildTree(size) {
    console.log(`Building fresh leaderboard of size ${size}...`);

    // Deploy a fresh leaderboard for each test to avoid cleanup issues
    leaderboard = await leaderboardFactory.deploy();
    // With ethers v6, we don't need to call deployed() anymore

    // Insert n elements
    for (let i = 0; i < size; i++) {
      const value = testValues[i];
      const address = testAddresses[i];
      await leaderboard.insert(value, address);

      // Log progress for larger trees
      if (size > 1000 && i % 500 === 0) {
        console.log(`  Inserted ${i} items...`);
      }
    }

    // Verify size
    const finalSize = await leaderboard.size();
    expect(finalSize).to.equal(size);
    return leaderboard;
  }

  // Test insert gas cost for each leaderboard size
  for (const size of treeSizes) {
    it(`should measure gas for insert at size ${size}`, async function () {
      // Skip larger tests when running on CI
      if (size > 1000 && process.env.CI) {
        this.skip();
        return;
      }

      // This test can take long for larger sizes
      this.timeout(size * 2000); // Increased timeout for larger trees

      // Build leaderboard with size-1 elements
      const currentTree = await buildTree(size - 1);

      // Measure gas for inserting an element
      const newAddress = testAddresses[5000]; // Use address from our pre-generated set
      const newValue = size * 1000;

      try {
        const tx = await currentTree.insert(newValue, newAddress);
        const receipt = await tx.wait();

        // Record gas used
        gasUsed.insert[size] = receipt.gasUsed.toString();

        console.log(
          `Gas used for insert at size ${
            size - 1
          }: ${receipt.gasUsed.toString()}`
        );
      } catch (error) {
        console.error(
          `Error during insert at size ${size - 1}:`,
          error.message
        );
        throw error;
      }
    });
  }

  // Test remove gas cost for each leaderboard size
  for (const size of treeSizes) {
    it(`should measure gas for remove at size ${size}`, async function () {
      // Skip larger tests when running on CI
      if (size > 1000 && process.env.CI) {
        this.skip();
        return;
      }

      // This test can take long for larger sizes
      this.timeout(size * 2000);

      // Build leaderboard with size elements
      const currentTree = await buildTree(size);

      try {
        // Measure gas for removing an element (from the middle)
        const targetIndex = Math.floor(size / 2);
        const targetAddress = await currentTree.getOwnerAtIndex(targetIndex);
        const tx = await currentTree.remove(targetAddress);
        const receipt = await tx.wait();

        // Record gas used
        gasUsed.remove[size] = receipt.gasUsed.toString();

        console.log(
          `Gas used for remove at size ${size}: ${receipt.gasUsed.toString()}`
        );
      } catch (error) {
        console.error(`Error during remove at size ${size}:`, error.message);
        throw error;
      }
    });
  }

  /* 
  // View function gas measurements - to be implemented in the future
  // Hardhat has limitations measuring view function gas usage
  // We would need a wrapper contract to properly measure this
  */

  // Additional test for insertion at the extremes of a large leaderboard
  it('should measure gas for insertions at different leaderboard positions', async function () {
    // Skip in CI
    if (process.env.CI) {
      this.skip();
      return;
    }

    this.timeout(1200000); // 20 minutes

    // Build a large leaderboard (500 nodes)
    const treeSize = 500;
    const currentTree = await buildTree(treeSize);

    try {
      // Test insertion at minimum value (beginning)
      let tx = await currentTree.insert(0, testAddresses[5001]);
      let receipt = await tx.wait();
      console.log(
        `Gas for insertion at MIN value (leaderboard size ${treeSize}): ${receipt.gasUsed.toString()}`
      );

      // Test insertion at middle value
      tx = await currentTree.insert(
        testValues[Math.floor(treeSize / 2)],
        testAddresses[5002]
      );
      receipt = await tx.wait();
      console.log(
        `Gas for insertion at MIDDLE value (leaderboard size ${
          treeSize + 1
        }): ${receipt.gasUsed.toString()}`
      );

      // Test insertion at maximum value (end)
      tx = await currentTree.insert(
        testValues[treeSize - 1] * 2,
        testAddresses[5003]
      );
      receipt = await tx.wait();
      console.log(
        `Gas for insertion at MAX value (leaderboard size ${
          treeSize + 2
        }): ${receipt.gasUsed.toString()}`
      );
    } catch (error) {
      console.error(
        'Error during position-specific insertion test:',
        error.message
      );
      throw error;
    }
  });

  // Print summary of gas costs
  after(function () {
    console.log('\n=== Gas Benchmark Summary ===');
    console.log('Tree Size | Insert Gas | Remove Gas');
    console.log('---------|------------|----------');

    for (const size of treeSizes) {
      const insertGas = gasUsed.insert[size] || 'N/A';
      const removeGas = gasUsed.remove[size] || 'N/A';

      console.log(
        `${size.toString().padEnd(9)} | ` +
          `${insertGas.padEnd(10)} | ` +
          `${removeGas}`
      );
    }

    console.log(
      '\nNote: View function gas measurements will be added in a future update.'
    );
  });
});

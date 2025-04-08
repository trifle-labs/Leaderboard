// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import the Leaderboard library
import "./Leaderboard.sol";

/**
 * @title LeaderboardTest Contract
 * @dev Hosts the Leaderboard library's storage ('s') for testing purposes.
 *      Wraps the library's internal functions to make them callable externally.
 */
contract LeaderboardTest {
    // Apply the library's functions to the storage struct 's'
    using Leaderboard for Leaderboard.s;

    // The storage struct instance holding the actual leaderboard data
    Leaderboard.s public leaderboardData;

    // Prevent multiple initializations
    bool public isInitialized;

    event LeaderboardInitialized(bool ascending);

    constructor(bool sortAscending) {
        initializeLeaderboard(sortAscending);
    }

    /**
     * @dev Initializes the hosted leaderboard storage. MUST be called once per instance.
     * @param sortAscending True for ascending order (high score = rank 0), false for descending (low score = rank 0).
     */
    function initializeLeaderboard(bool sortAscending) public {
        require(!isInitialized, "LeaderboardTest: Already initialized");
        leaderboardData.init(sortAscending);
        isInitialized = true;
        emit LeaderboardInitialized(sortAscending);
    }

    // --- State Modifying Wrappers ---

    function insert(uint256 value, address owner) public {
        require(isInitialized, "LeaderboardTest: Not initialized");
        leaderboardData.insert(value, owner);
    }

    function remove(address owner) public {
        require(isInitialized, "LeaderboardTest: Not initialized");
        leaderboardData.remove(owner);
    }

    // --- View Function Wrappers ---

    function size() public view returns (uint256) {
        return leaderboardData.size();
    }

    function contains(address owner) public view returns (bool) {
        // Check initialization because contains might access ownerToNode mapping
        // which is only valid post-init (though check against 0 might work by chance).
        // For safety, assume view functions also need init unless explicitly designed otherwise.
        // if (!isInitialized) return false; // Alternative: Return default if not initialized
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.contains(owner);
    }

    function getValue(address owner) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getValue(owner);
    }

    function getValueAndOwnerAtRank(
        uint256 rank
    ) public view returns (uint256 value, address owner) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getValueAndOwnerAtRank(rank);
    }

    function getValueAtRank(uint256 rank) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getValueAtRank(rank);
    }

    function getOwnerAtRank(uint256 rank) public view returns (address) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getOwnerAtRank(rank);
    }

    function getValueAndOwnerAtIndex(
        uint256 index
    ) public view returns (uint256 value, address owner) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getValueAndOwnerAtIndex(index);
    }

    function getValueAtIndex(uint256 index) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getValueAtIndex(index);
    }

    function getOwnerAtIndex(uint256 index) public view returns (address) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getOwnerAtIndex(index);
    }

    function getIndexOfOwner(address owner) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getIndexOfOwner(owner);
    }

    function getRankOfOwner(address owner) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getRankOfOwner(owner);
    }

    function getNonce(address owner) public view returns (uint256) {
        require(isInitialized, "LeaderboardTest: Not initialized for view");
        return leaderboardData.getNonce(owner);
    }

    // --- Test Helper Wrapper ---

    /**
     * @dev Wrapper for the library's internal tree validation function. Gas intensive.
     */
    function _testIsValidTree() public view returns (bool) {
        require(isInitialized, "LeaderboardTest: Not initialized for test");
        return leaderboardData._testIsValidTree();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Leaderboard Library
 * @dev Implementation of Left-Leaning Red-Black Tree with the following characteristics:
 * - Values are sorted in increasing order (smallest at index 0)
 * - Each node stores a value and an associated address
 * - Each address can only have one entry at a time
 * - Nodes can be queried by sorted index
 * - When two nodes have the same value, the older node is given the higher index
 * - Age of nodes is tracked using an insertion nonce and cleaned up on removal
 */
library Leaderboard {
    enum Color {
        RED,
        BLACK
    }

    struct Node {
        uint256 value; // The value to be sorted
        address owner; // The address associated with this value
        uint256 nonce; // Insertion nonce (for breaking ties)
        uint256 size; // Size of the subtree (augmentation for index queries)
        Color color; // Color of the node
        uint256 left; // ID of left child
        uint256 right; // ID of right child
    }

    // Using 's' for the storage struct name as requested.
    struct s {
        mapping(uint256 => Node) nodes; // Node storage by node ID
        mapping(address => uint256) ownerToNode; // Maps owner address to their node ID
        uint256 root; // Root node ID
        uint256 NIL; // Sentinel node ID
        uint256 nodeCount; // Total number of nodes in the tree instance
        uint256 insertionNonce; // Monotonically increasing nonce for insertion order
        bool ascending; // Sort order: true = ascending (high score best), false = descending (low score best)
    }

    // Events
    event NodeInserted(address indexed owner, uint256 value, uint256 nonce);
    event NodeRemoved(address indexed owner, uint256 value);

    /**
     * @dev Initializes the leaderboard storage struct. MUST be called before
     *      using any other functions on a specific leaderboard instance.
     * @param self The storage struct instance for the leaderboard.
     * @param sortAscending True for ascending order (high score best), false for descending (low score best).
     */
    function init(s storage self, bool sortAscending) internal {
        self.NIL = 0;
        self.nodes[self.NIL] = Node({
            value: 0,
            owner: address(0),
            nonce: 0,
            size: 0,
            color: Color.BLACK,
            left: self.NIL,
            right: self.NIL
        });
        self.root = self.NIL;
        self.nodeCount = 0;
        self.insertionNonce = 0;
        self.ascending = sortAscending;
    }

    // --- Public View Functions (Now Internal) ---

    /**
     * @dev Get the number of nodes in the tree instance.
     * @param self The leaderboard storage instance.
     * @return The total number of nodes.
     */
    function size(s storage self) internal view returns (uint256) {
        return self.nodeCount;
    }

    /**
     * @dev Check if the tree contains a node for the given address.
     * @param self The leaderboard storage instance.
     * @param owner The address to check.
     * @return True if the address has a node in the tree.
     */
    function contains(
        s storage self,
        address owner
    ) internal view returns (bool) {
        return self.ownerToNode[owner] != 0;
    }

    /**
     * @dev Get the value associated with an address. Reverts if owner not found.
     * @param self The leaderboard storage instance.
     * @param owner The address to look up.
     * @return The value associated with the address.
     */
    function getValue(
        s storage self,
        address owner
    ) internal view returns (uint256) {
        uint256 nodeId = self.ownerToNode[owner];
        require(
            nodeId != 0 && nodeId != self.NIL,
            "Owner does not exist in the leaderboard"
        );
        return self.nodes[nodeId].value;
    }

    /**
     * @dev Insert a new value with associated address
     * @param value The value to insert
     * @param owner The address to associate with the value
     */
    function insert(s storage self, uint256 value, address owner) internal {
        require(owner != address(0), "Cannot insert zero address");

        // If owner already exists, remove their current node first
        if (self.ownerToNode[owner] != 0) {
            remove(self, owner); // Use internal remove helper
        }

        // Create a new node with increasing nonce
        uint256 nonce = self.insertionNonce++;
        uint256 nodeId = _createNode(self, value, owner, nonce);

        // Insert the node into the tree
        self.root = _insert(self, self.root, nodeId);
        self.nodes[self.root].color = Color.BLACK;

        // Update mappings
        self.ownerToNode[owner] = nodeId;
        self.nodeCount++;

        emit NodeInserted(owner, value, nonce);
    }

    /**
     * @dev Remove a node by owner address.
     * @param self The leaderboard storage instance.
     * @param owner The address whose node should be removed.
     */
    function remove(s storage self, address owner) internal {
        uint256 nodeId = self.ownerToNode[owner];
        // Allow removing non-existent owner silently? No, require for safety.
        require(
            nodeId != 0 && nodeId != self.NIL,
            "Owner does not exist in the leaderboard"
        );

        uint256 value = self.nodes[nodeId].value; // Get value before potential modification
        // If the tree becomes 2-3-4 tree (temporarily)
        if (
            !_isRed(self, self.nodes[self.root].left) &&
            !_isRed(self, self.nodes[self.root].right)
        ) {
            self.nodes[self.root].color = Color.RED;
        }
        // TODO: confirm whether this is an improvement on the previous lines?
        // // Handle root color flip for 2-3-4 tree property if necessary before removal
        // if (self.root != self.NIL) {
        //     // Check if tree is not empty
        //     Node storage rootNode = self.nodes[self.root];
        //     // Check children *before* accessing them
        //     bool leftExists = rootNode.left != self.NIL;
        //     bool rightExists = rootNode.right != self.NIL;
        //     if (
        //         (!leftExists || !_isRed(self, rootNode.left)) &&
        //         (!rightExists || !_isRed(self, rootNode.right))
        //     ) {
        //         rootNode.color = Color.RED;
        //     }
        // }

        self.root = _remove(self, self.root, nodeId);

        if (self.root != self.NIL) {
            self.nodes[self.root].color = Color.BLACK;
        }

        // Clean up mappings
        delete self.ownerToNode[owner];
        self.nodeCount--;

        // delete self.nodes[nodeId]
        // Note: We don't delete from self.nodes[nodeId] to potentially save gas on rehashing,
        // but the node is unreachable via ownerToNode or tree traversal.
        // Consider if explicit deletion is needed for state clearing reasons.

        emit NodeRemoved(owner, value);
    }

    /**
     * @dev Get the value and owner address at a specific rank. Rank 0 is the most desirable score.
     * @param self The leaderboard storage instance.
     * @param rank The rank (0 is most desirable score).
     * @return value The value at the given rank.
     * @return owner The owner address at the given rank.
     */
    function getValueAndOwnerAtRank(
        s storage self,
        uint256 rank
    ) internal view returns (uint256 value, address owner) {
        require(rank < self.nodeCount, "Rank out of bounds");
        // Convert rank to index. Rank 0 = rightmost node (index size-1).
        uint256 index = self.nodeCount - rank - 1;
        uint256 nodeId = _findByIndex(self, self.root, index);
        Node storage n = self.nodes[nodeId];
        return (n.value, n.owner);
    }

    /**
     * @dev Get the value at a specific rank. Rank 0 is the most desirable score.
     * @param self The leaderboard storage instance.
     * @param rank The rank (0 is most desirable score).
     * @return The value at the given rank.
     */
    function getValueAtRank(
        s storage self,
        uint256 rank
    ) internal view returns (uint256) {
        (uint256 value, ) = getValueAndOwnerAtRank(self, rank);
        return value;
    }

    /**
     * @dev Get the owner address at a specific rank. Rank 0 is the most desirable score.
     * @param self The leaderboard storage instance.
     * @param rank The rank (0 is most desirable score).
     * @return The owner address at the given rank.
     */
    function getOwnerAtRank(
        s storage self,
        uint256 rank
    ) internal view returns (address) {
        (, address owner) = getValueAndOwnerAtRank(self, rank);
        return owner;
    }

    /**
     * @dev Get the value andowner address at a specific index in the sorted order.
     * @param self The leaderboard storage instance.
     * @param index The index (0 is leftmost node, least desirable rank).
     * @return value The value at the given index.
     * @return owner The owner address at the given index.
     **/

    function getValueAndOwnerAtIndex(
        s storage self,
        uint256 index
    ) internal view returns (uint256 value, address owner) {
        require(index < self.nodeCount, "Index out of bounds");
        uint256 nodeId = _findByIndex(self, self.root, index);
        require(nodeId != self.NIL, "Node not found at index"); // Should not happen if index < nodeCount
        Node storage n = self.nodes[nodeId];
        return (n.value, n.owner);
    }

    /**
     * @dev Get the value at a specific index in the sorted order.
     * @param self The leaderboard storage instance.
     * @param index The index (0 is leftmost node, least desirable rank).
     * @return The value at the given index.
     */
    function getValueAtIndex(
        s storage self,
        uint256 index
    ) internal view returns (uint256) {
        (uint256 value, ) = getValueAndOwnerAtIndex(self, index);
        return value;
    }

    /**
     * @dev Get the owner address at a specific index in the sorted order.
     * @param self The leaderboard storage instance.
     * @param index The index (0 is leftmost node, least desirable rank).
     * @return The owner address at the given index.
     **/
    function getOwnerAtIndex(
        s storage self,
        uint256 index
    ) internal view returns (address) {
        (, address owner) = getValueAndOwnerAtIndex(self, index);
        return owner;
    }

    /**
     * @dev Get the 0-based index of a node for a given owner
     * @param self The leaderboard storage instance.
     * @param owner The address to find the index of.
     * @return The 0-based index. Reverts if owner not found.
     */
    function getIndexOfOwner(
        s storage self,
        address owner
    ) internal view returns (uint256) {
        uint256 nodeId = self.ownerToNode[owner];
        require(
            nodeId != 0 && nodeId != self.NIL,
            "Owner does not exist in the leaderboard"
        );
        return _getNodeIndex(self, nodeId);
    }

    /**
     * @dev Get the rank of a specific owner. Rank 0 is the most desirable score.
     * @param self The leaderboard storage instance.
     * @param owner The address to find the rank of.
     * @return The 0-based rank of the owner. Reverts if owner not found.
     */
    function getRankOfOwner(
        s storage self,
        address owner
    ) internal view returns (uint256) {
        uint256 nodeId = self.ownerToNode[owner];
        require(
            nodeId != 0 && nodeId != self.NIL,
            "Owner does not exist in the leaderboard"
        );
        uint256 index = _getNodeIndex(self, nodeId);
        // Convert index to rank. Rank 0 = rightmost node (index size-1).
        return self.nodeCount - 1 - index;
    }

    /**
     * @dev Get the insertion nonce associated with an address.
     * @param self The leaderboard storage instance.
     * @param owner The address to look up.
     * @return The nonce associated with the address. Reverts if owner not found.
     */
    function getNonce(
        s storage self,
        address owner
    ) internal view returns (uint256) {
        uint256 nodeId = self.ownerToNode[owner];
        require(
            nodeId != 0 && nodeId != self.NIL,
            "Owner does not exist in the leaderboard"
        );
        return self.nodes[nodeId].nonce;
    }

    // --- State Modifying Functions (Now Internal) ---
    // --- Internal Helper Functions ---

    /**
     * @dev Internal function to create and store a new node.
     * @param self The leaderboard storage instance.
     * @param value The value to insert.
     * @param owner The address to associate with the value.
     * @param nonce The nonce to associate with the value.
     * @return nodeId The ID of the newly created node.
     */
    function _createNode(
        s storage self,
        uint256 value,
        address owner,
        uint256 nonce
    ) private returns (uint256) {
        // Use keccak256 to generate a unique ID for the node
        uint256 nodeId = uint256(
            keccak256(abi.encodePacked(value, owner, nonce, self.nodeCount))
        );

        // Create the node
        self.nodes[nodeId] = Node({
            value: value,
            owner: owner,
            nonce: nonce,
            size: 1,
            color: Color.RED, // New nodes are always red
            left: self.NIL,
            right: self.NIL
        });

        return nodeId;
    }

    /**
     * @dev Internal function to recursively insert a node.
     */
    function _insert(
        s storage self,
        uint256 h,
        uint256 nodeId
    ) private returns (uint256) {
        if (h == self.NIL) {
            return nodeId; // Insertion point found
        }

        // Compare value and nonce for insertion order:
        // - First by value (ascending)
        // - Then by nonce (descending, lower nonce is older and should be higher in tree for same value)
        // Get references to nodes involved
        Node storage node = self.nodes[nodeId];
        Node storage hNode = self.nodes[h];

        bool sort = self.ascending
            ? node.value < hNode.value
            : node.value > hNode.value;

        if (sort || (node.value == hNode.value && node.nonce > hNode.nonce)) {
            // Insert to the left
            hNode.left = _insert(self, hNode.left, nodeId);
        } else {
            // Insert to the right
            hNode.right = _insert(self, hNode.right, nodeId);
        }

        // Fix Right-leaning red nodes (LLRB property)
        if (_isRed(self, hNode.right) && !_isRed(self, hNode.left)) {
            h = _rotateLeft(self, h);
            hNode = self.nodes[h]; // Update hNode after rotation
        }

        // Fix two consecutive red nodes
        if (
            _isRed(self, hNode.left) &&
            _isRed(self, self.nodes[hNode.left].left)
        ) {
            h = _rotateRight(self, h);
            hNode = self.nodes[h]; // Update hNode after rotation
        }

        // Split 4-nodes
        if (_isRed(self, hNode.left) && _isRed(self, hNode.right)) {
            _flipColors(self, h);
        }

        // Update the size
        _updateSize(self, h);

        return h;
    }

    /**
     * @dev Internal function to remove a node recursively.
     */
    function _remove(
        s storage self,
        uint256 h,
        uint256 nodeId
    ) private returns (uint256) {
        Node storage hNode = self.nodes[h];
        Node storage target = self.nodes[nodeId];
        bool sort = self.ascending
            ? target.value < hNode.value
            : target.value > hNode.value;
        if (
            sort || (target.value == hNode.value && target.nonce > hNode.nonce)
        ) {
            // Target is to the left
            if (
                !_isRed(self, hNode.left) &&
                !_isRed(self, self.nodes[hNode.left].left)
            ) {
                h = _moveRedLeft(self, h);
                hNode = self.nodes[h]; // Update hNode after move
            }
            hNode.left = _remove(self, hNode.left, nodeId);
        } else {
            // Target is this node or to the right
            if (_isRed(self, hNode.left)) {
                h = _rotateRight(self, h);
                hNode = self.nodes[h]; // Reload hNode after rotation
            }

            if (nodeId == h && hNode.right == self.NIL) {
                // TODO: check what happens when _remove returns NIL;
                return self.NIL;
            }

            // Ensure right path has a red node to borrow from if needed
            if (
                !_isRed(self, hNode.right) &&
                !_isRed(self, self.nodes[hNode.right].left)
            ) {
                h = _moveRedRight(self, h);
                hNode = self.nodes[h]; // Reload hNode
            }

            if (nodeId == h) {
                // Find the minimum node in the right subtree
                uint256 minRightId = _findMin(self, hNode.right);
                Node storage minRight = self.nodes[minRightId];
                // Copy data from successor
                hNode.value = minRight.value;
                hNode.owner = minRight.owner;
                hNode.nonce = minRight.nonce;

                // Update the reference in ownerToNode
                self.ownerToNode[hNode.owner] = h;

                // Remove the successor
                hNode.right = _removeMin(self, hNode.right);
            } else {
                hNode.right = _remove(self, hNode.right, nodeId);
            }
        }
        return _balance(self, h);
    }

    /**
     * @dev Remove the minimum node in a subtree
     * @return The new root of the subtree
     */
    function _removeMin(s storage self, uint256 h) private returns (uint256) {
        if (self.nodes[h].left == self.NIL) {
            return self.NIL; // Nothing to remove or h is the min
        }

        Node storage hNode = self.nodes[h];
        if (
            !_isRed(self, hNode.left) &&
            !_isRed(self, self.nodes[hNode.left].left)
        ) {
            h = _moveRedLeft(self, h);
            hNode = self.nodes[h]; // Reload hNode
        }

        hNode.left = _removeMin(self, hNode.left);

        return _balance(self, h);
    }

    /**
     * @dev Balance a node after removal operations
     */
    function _balance(s storage self, uint256 h) private returns (uint256) {
        if (h == self.NIL) return self.NIL; // Added check for safety
        Node storage hNode = self.nodes[h];

        // Rotate left if right-leaning red link
        if (_isRed(self, hNode.right)) {
            // We don't need && !_isRed(hNode.left) here according to Sedgewick
            h = _rotateLeft(self, h);
            hNode = self.nodes[h]; // Reload hNode
        }

        // Rotate right if two consecutive left red links
        if (
            _isRed(self, hNode.left) &&
            _isRed(self, self.nodes[hNode.left].left)
        ) {
            h = _rotateRight(self, h);
            hNode = self.nodes[h]; // Reload hNode
        }

        // Flip colors if 4-node (both children red)
        if (_isRed(self, hNode.left) && _isRed(self, hNode.right)) {
            _flipColors(self, h);
        }

        _updateSize(self, h);
        return h;
    }

    /**
     * @dev Move a red node from the right to the left
     */
    function _moveRedLeft(s storage self, uint256 h) private returns (uint256) {
        // Assuming h is red and both children are black, make left child red.
        _flipColors(self, h);
        Node storage hNode = self.nodes[h]; // Get after flip

        // If right child's left child is red, need extra rotations
        if (_isRed(self, self.nodes[hNode.right].left)) {
            hNode.right = _rotateRight(self, hNode.right);
            h = _rotateLeft(self, h);
            _flipColors(self, h); // Flip back colors of the new subtree root and its children
        }

        return h;
    }

    /**
     * @dev Move a red node from the left to the right
     */
    function _moveRedRight(
        s storage self,
        uint256 h
    ) private returns (uint256) {
        // Assuming h is red and both children are black, make right child red.
        _flipColors(self, h);
        Node storage hNode = self.nodes[h]; // Get after flip

        // If left child's left child is red, need extra rotation
        if (_isRed(self, self.nodes[hNode.left].left)) {
            h = _rotateRight(self, h);
            _flipColors(self, h); // Flip back colors of the new subtree root and its children
        }

        return h;
    }

    /**
     * @dev Rotate a node to the left
     */
    function _rotateLeft(s storage self, uint256 h) private returns (uint256) {
        Node storage hNode = self.nodes[h];
        uint256 x = hNode.right;
        Node storage xNode = self.nodes[x];

        hNode.right = xNode.left;
        xNode.left = h;
        xNode.color = hNode.color;
        hNode.color = Color.RED;

        xNode.size = hNode.size;
        _updateSize(self, h); // Update original h size first

        return x; // New root of this subtree
    }

    /**
     * @dev Rotate a node to the right
     */

    function _rotateRight(s storage self, uint256 h) private returns (uint256) {
        Node storage hNode = self.nodes[h];
        uint256 x = hNode.left;
        Node storage xNode = self.nodes[x];

        hNode.left = xNode.right;
        xNode.right = h;
        xNode.color = hNode.color;
        hNode.color = Color.RED;

        xNode.size = hNode.size;
        _updateSize(self, h); // Update original h size first

        return x; // New root of this subtree
    }

    /**
     * @dev Flip the colors of a node and its children
     */
    function _flipColors(s storage self, uint256 h) private {
        Node storage hNode = self.nodes[h];
        hNode.color = hNode.color == Color.RED ? Color.BLACK : Color.RED;
        self.nodes[hNode.left].color = self.nodes[hNode.left].color == Color.RED
            ? Color.BLACK
            : Color.RED;
        self.nodes[hNode.right].color = self.nodes[hNode.right].color ==
            Color.RED
            ? Color.BLACK
            : Color.RED;
    }

    /**
     * @dev Update the size of a node based on its children
     */
    function _updateSize(s storage self, uint256 h) private {
        Node storage hNode = self.nodes[h];
        hNode.size =
            _getSize(self, hNode.left) +
            _getSize(self, hNode.right) +
            1;
    }

    /**
     * @dev Get the size of a subtree
     */
    function _getSize(
        s storage self,
        uint256 h
    ) private view returns (uint256) {
        if (h == self.NIL) return 0;
        return self.nodes[h].size;
    }

    /**
     * @dev Check if a node is red
     */
    function _isRed(
        s storage self,
        uint256 nodeId
    ) private view returns (bool) {
        if (nodeId == self.NIL) return false;
        return self.nodes[nodeId].color == Color.RED;
    }

    // /** @dev Helper to invert color represented as uint8 */
    // function _compare(
    //     s storage self,
    //     uint256 nodeAId,
    //     uint256 nodeBId
    // ) private view returns (int8) {
    //     Node storage nodeA = self.nodes[nodeAId];
    //     Node storage nodeB = self.nodes[nodeBId];

    //     if (nodeA.value < nodeB.value) {
    //         // Fix: Cast literals to int8
    //         return self.ascending ? int8(-1) : int8(1);
    //     }
    //     if (nodeA.value > nodeB.value) {
    //         // Fix: Cast literals to int8
    //         return self.ascending ? int8(1) : int8(-1);
    //     }

    //     if (nodeA.nonce < nodeB.nonce) {
    //         // Fix: Cast literal to int8
    //         return int8(-1);
    //     }
    //     if (nodeA.nonce > nodeB.nonce) {
    //         // Fix: Cast literal to int8
    //         return int8(1);
    //     }

    //     return int8(0);
    // }

    // // --- LLRB Helper Functions (modified for library context) ---
    // function _invertColor(uint8 color) private pure returns (uint8) {
    //     return 1 - color; // 1-RED(0) = BLACK(1), 1-BLACK(1) = RED(0)
    // }

    /** @dev Find node by 0-based index in the sorted sequence. */
    function _findByIndex(
        s storage self,
        uint256 h,
        uint256 index
    ) private view returns (uint256) {
        if (h == self.NIL) {
            revert("Index out of bounds");
        }
        // TODO: check whether the while version avoids stack overflow
        // uint256 current = h;
        // while (current != self.NIL) {
        //     Node storage node = self.nodes[current];
        //     uint256 leftSize = node.left != self.NIL
        //         ? self.nodes[node.left].size
        //         : 0;
        //     if (index < leftSize) {
        //         current = node.left; // Go left
        //     } else if (index == leftSize) {
        //         return current; // Found the node at this index
        //     } else {
        //         index = index - leftSize - 1; // Adjust index for right subtree
        //         current = node.right; // Go right
        //     }
        // }
        // return self.NIL; // Should not be reached if index is valid
        // }

        uint256 leftSize = _getSize(self, self.nodes[h].left);

        if (index < leftSize) {
            // The node is in the left subtree
            return _findByIndex(self, self.nodes[h].left, index);
        } else if (index > leftSize) {
            // The node is in the right subtree
            return
                _findByIndex(self, self.nodes[h].right, index - leftSize - 1);
        } else {
            // This is the node we're looking for
            return h;
        }
    }

    /**
     * @dev Find the index of a specific node
     */
    /** @dev Get the 0-based index of a specific node ID. */
    function _getNodeIndex(
        s storage self,
        uint256 nodeId
    ) private view returns (uint256) {
        uint256 index = _getSize(self, self.nodes[nodeId].left);
        uint256 current = nodeId;
        uint256 parent;

        while (current != self.root) {
            parent = _findParent(self, current);
            if (self.nodes[parent].right == current) {
                index += _getSize(self, self.nodes[parent].left) + 1;
            }
            current = parent;
        }

        return index;
    }

    /**
     * @dev Find the parent of a node
     */
    // TODO: check whether this is a gas-heavy operation
    function _findParent(
        s storage self,
        uint256 nodeId
    ) private view returns (uint256) {
        if (nodeId == self.root) return self.NIL;
        return _findParentTraverse(self, self.root, nodeId);
    }

    /**
     * @dev Recursive helper to find parent node
     */
    function _findParentTraverse(
        s storage self,
        uint256 curr,
        uint256 target
    ) private view returns (uint256) {
        if (curr == self.NIL) return self.NIL;
        if (self.nodes[curr].left == target || self.nodes[curr].right == target)
            return curr;

        uint256 found = _findParentTraverse(
            self,
            self.nodes[curr].left,
            target
        );
        if (found != self.NIL) return found;

        return _findParentTraverse(self, self.nodes[curr].right, target);
    }

    /**
     * @dev Find the minimum node in a subtree
     */
    function _findMin(
        s storage self,
        uint256 h
    ) private view returns (uint256) {
        if (h == self.NIL) return self.NIL;
        if (self.nodes[h].left == self.NIL) return h;

        return _findMin(self, self.nodes[h].left);
    }

    // TEST HELPER FUNCTIONS - ONLY FOR TESTING, CAN BE REMOVED IN PRODUCTION

    /**
     * @dev Get the color of a node - for testing only
     */
    function _testGetNodeColor(
        s storage self,
        uint256 nodeId
    ) internal view returns (Color) {
        return self.nodes[nodeId].color;
    }

    // --- Test Helpers (Keep internal or remove for production) ---
    /**
     * @dev Get the root node ID - for testing only
     */
    function _testGetRoot(s storage self) internal view returns (uint256) {
        return self.root;
    }

    /**
     * @dev Check if the tree is a valid LLRB tree - for testing only
     */
    function _testIsValidTree(s storage self) internal view returns (bool) {
        // 1. Root is black
        if (
            self.root != self.NIL && self.nodes[self.root].color != Color.BLACK
        ) {
            return false;
        }

        // 2. No consecutive red nodes
        // 3. Perfect black balance
        uint256 blackCount = type(uint256).max; // Use max value as sentinel
        return _testIsValidNode(self, self.root, Color.BLACK, 0, blackCount);
    }

    function _testIsValidNode(
        s storage self,
        uint256 nodeId,
        Color parentColor,
        uint256 blackHeight,
        uint256 blackCount
    ) internal view returns (bool) {
        if (nodeId == self.NIL) {
            // First NIL node will set the expected black count
            if (blackCount == type(uint256).max) {
                // Check against sentinel value
                blackCount = blackHeight;
                return true;
            }
            // All paths must have the same number of black nodes
            return blackHeight == blackCount;
        }

        Node storage node = self.nodes[nodeId];

        // No consecutive red nodes
        if (parentColor == Color.RED && node.color == Color.RED) {
            return false;
        }

        // Accumulate black height if this node is black
        uint256 nextBlackHeight = blackHeight;
        if (node.color == Color.BLACK) {
            nextBlackHeight++;
        }

        // Check left and right subtrees
        return
            _testIsValidNode(
                self,
                node.left,
                node.color,
                nextBlackHeight,
                blackCount
            ) &&
            _testIsValidNode(
                self,
                node.right,
                node.color,
                nextBlackHeight,
                blackCount
            );
    }
}

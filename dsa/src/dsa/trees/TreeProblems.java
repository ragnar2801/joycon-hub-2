package dsa.trees;

import dsa.common.TreeNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Queue;

/** Binary trees: recursion (DFS), level-order traversal (BFS) and BST properties. */
public final class TreeProblems {
    private TreeProblems() {}

    /**
     * LC 104 Maximum Depth of Binary Tree. Depth = 1 + deeper subtree.
     *
     * <p>Time O(n). Space O(height) for the recursion.
     */
    public static int maxDepth(TreeNode root) {
        return root == null ? 0 : 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }

    /**
     * LC 94 Binary Tree Inorder Traversal, iteratively with an explicit stack: go left as far as
     * possible, visit, then go right.
     *
     * <p>Time O(n). Space O(height).
     */
    public static List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> out = new ArrayList<>();
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode node = root;
        while (node != null || !stack.isEmpty()) {
            while (node != null) {
                stack.push(node);
                node = node.left;
            }
            node = stack.pop();
            out.add(node.val);
            node = node.right;
        }
        return out;
    }

    /**
     * LC 102 Binary Tree Level Order Traversal. BFS with a queue; the queue size at the start of
     * each round is the size of that level.
     *
     * <p>Time O(n). Space O(width).
     */
    public static List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> levels = new ArrayList<>();
        if (root == null) {
            return levels;
        }
        Queue<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            List<Integer> level = new ArrayList<>();
            for (int size = queue.size(); size > 0; size--) {
                TreeNode node = queue.poll();
                level.add(node.val);
                if (node.left != null) {
                    queue.add(node.left);
                }
                if (node.right != null) {
                    queue.add(node.right);
                }
            }
            levels.add(level);
        }
        return levels;
    }

    /**
     * LC 98 Validate Binary Search Tree. Every node must lie strictly inside the (low, high)
     * range inherited from its ancestors, not just compare with its children. Long bounds handle
     * Integer.MIN_VALUE / MAX_VALUE nodes.
     *
     * <p>Time O(n). Space O(height).
     */
    public static boolean isValidBST(TreeNode root) {
        return isValidBST(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private static boolean isValidBST(TreeNode node, long low, long high) {
        if (node == null) {
            return true;
        }
        if (node.val <= low || node.val >= high) {
            return false;
        }
        return isValidBST(node.left, low, node.val) && isValidBST(node.right, node.val, high);
    }

    /**
     * LC 236 Lowest Common Ancestor of a Binary Tree. If p and q are found in different subtrees
     * of a node, that node is the LCA; otherwise the LCA is whichever side found something.
     *
     * <p>Time O(n). Space O(height).
     */
    public static TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) {
            return root;
        }
        TreeNode left = lowestCommonAncestor(root.left, p, q);
        TreeNode right = lowestCommonAncestor(root.right, p, q);
        if (left != null && right != null) {
            return root;
        }
        return left != null ? left : right;
    }
}

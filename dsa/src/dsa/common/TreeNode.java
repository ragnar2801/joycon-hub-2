package dsa.common;

import java.util.ArrayDeque;
import java.util.Queue;

/** Binary tree node, as used by LeetCode. */
public class TreeNode {
    public int val;
    public TreeNode left;
    public TreeNode right;

    public TreeNode(int val) {
        this.val = val;
    }

    /**
     * Builds a tree from LeetCode's level-order format, where null marks a missing child. For
     * example {@code fromLevelOrder(3, 9, 20, null, null, 15, 7)}.
     */
    public static TreeNode fromLevelOrder(Integer... values) {
        if (values.length == 0 || values[0] == null) {
            return null;
        }
        TreeNode root = new TreeNode(values[0]);
        Queue<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        int i = 1;
        while (!queue.isEmpty() && i < values.length) {
            TreeNode node = queue.poll();
            if (i < values.length && values[i] != null) {
                node.left = new TreeNode(values[i]);
                queue.add(node.left);
            }
            i++;
            if (i < values.length && values[i] != null) {
                node.right = new TreeNode(values[i]);
                queue.add(node.right);
            }
            i++;
        }
        return root;
    }

    /** Returns the first node holding {@code val} (depth-first), or null. */
    public static TreeNode find(TreeNode root, int val) {
        if (root == null || root.val == val) {
            return root;
        }
        TreeNode left = find(root.left, val);
        return left != null ? left : find(root.right, val);
    }
}

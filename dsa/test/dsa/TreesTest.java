package dsa;

import static dsa.common.TreeNode.fromLevelOrder;

import dsa.common.TreeNode;
import dsa.trees.TreeProblems;
import dsa.trees.Trie;
import java.util.List;

final class TreesTest {
    static void run(Check c) {
        TreeNode tree = fromLevelOrder(3, 9, 20, null, null, 15, 7);
        c.eq("maxDepth", 3, TreeProblems.maxDepth(tree));
        c.eq("maxDepth empty", 0, TreeProblems.maxDepth(null));
        c.eq("levelOrder", List.of(List.of(3), List.of(9, 20), List.of(15, 7)), TreeProblems.levelOrder(tree));
        c.eq("inorderTraversal", List.of(1, 3, 2), TreeProblems.inorderTraversal(fromLevelOrder(1, null, 2, 3)));
        c.isTrue("isValidBST", TreeProblems.isValidBST(fromLevelOrder(2, 1, 3)));
        c.isFalse("isValidBST deep violation", TreeProblems.isValidBST(fromLevelOrder(5, 4, 6, null, null, 3, 7)));
        c.isTrue("isValidBST int max", TreeProblems.isValidBST(fromLevelOrder(Integer.MAX_VALUE)));

        TreeNode root = fromLevelOrder(3, 5, 1, 6, 2, 0, 8, null, null, 7, 4);
        c.eq("lowestCommonAncestor", 3, TreeProblems.lowestCommonAncestor(
                root, TreeNode.find(root, 5), TreeNode.find(root, 1)).val);
        c.eq("lowestCommonAncestor self", 5, TreeProblems.lowestCommonAncestor(
                root, TreeNode.find(root, 5), TreeNode.find(root, 4)).val);

        Trie trie = new Trie();
        trie.insert("apple");
        c.isTrue("Trie search", trie.search("apple"));
        c.isFalse("Trie prefix is not a word", trie.search("app"));
        c.isTrue("Trie startsWith", trie.startsWith("app"));
        trie.insert("app");
        c.isTrue("Trie search after insert", trie.search("app"));
    }
}

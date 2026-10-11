package dsa.backtracking;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Backtracking: build a candidate step by step (choose), recurse (explore), then undo the choice
 * (un-choose). Prune branches that can't lead to an answer.
 */
public final class BacktrackingProblems {
    private BacktrackingProblems() {}

    /**
     * LC 78 Subsets. Every node of the recursion tree is a subset; elements are only taken from
     * index start onwards, so no subset repeats.
     *
     * <p>Time O(n * 2^n). Space O(n) besides the output.
     */
    public static List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> out = new ArrayList<>();
        subsets(nums, 0, new ArrayList<>(), out);
        return out;
    }

    private static void subsets(int[] nums, int start, List<Integer> path, List<List<Integer>> out) {
        out.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            path.add(nums[i]);
            subsets(nums, i + 1, path, out);
            path.remove(path.size() - 1);
        }
    }

    /**
     * LC 46 Permutations (distinct numbers). A used[] array tracks which numbers are in the path.
     *
     * <p>Time O(n * n!). Space O(n) besides the output.
     */
    public static List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> out = new ArrayList<>();
        permute(nums, new boolean[nums.length], new ArrayList<>(), out);
        return out;
    }

    private static void permute(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> out) {
        if (path.size() == nums.length) {
            out.add(new ArrayList<>(path));
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) {
                continue;
            }
            used[i] = true;
            path.add(nums[i]);
            permute(nums, used, path, out);
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }

    /**
     * LC 39 Combination Sum (each candidate reusable). Sorting lets us stop early once a
     * candidate exceeds what remains; recursing with the same index allows reuse.
     *
     * <p>Time exponential in target / min(candidate). Space O(target / min(candidate)).
     */
    public static List<List<Integer>> combinationSum(int[] candidates, int target) {
        int[] sorted = candidates.clone();
        Arrays.sort(sorted);
        List<List<Integer>> out = new ArrayList<>();
        combinationSum(sorted, 0, target, new ArrayList<>(), out);
        return out;
    }

    private static void combinationSum(
            int[] c, int start, int remaining, List<Integer> path, List<List<Integer>> out) {
        if (remaining == 0) {
            out.add(new ArrayList<>(path));
            return;
        }
        for (int i = start; i < c.length && c[i] <= remaining; i++) {
            path.add(c[i]);
            combinationSum(c, i, remaining - c[i], path, out);
            path.remove(path.size() - 1);
        }
    }

    /**
     * LC 52 N-Queens II: count the ways to place n queens with no two attacking. Place one queen
     * per row; track used columns and both diagonals (r - c and r + c are constant along them).
     *
     * <p>Time O(n!). Space O(n).
     */
    public static int totalNQueens(int n) {
        return placeQueens(0, n, new boolean[n], new boolean[2 * n], new boolean[2 * n]);
    }

    private static int placeQueens(int row, int n, boolean[] cols, boolean[] diag, boolean[] anti) {
        if (row == n) {
            return 1;
        }
        int count = 0;
        for (int c = 0; c < n; c++) {
            int d = row - c + n;
            int a = row + c;
            if (cols[c] || diag[d] || anti[a]) {
                continue;
            }
            cols[c] = diag[d] = anti[a] = true;
            count += placeQueens(row + 1, n, cols, diag, anti);
            cols[c] = diag[d] = anti[a] = false;
        }
        return count;
    }
}

package dsa.dp;

import java.util.Arrays;

/**
 * Dynamic programming: define the state, write the recurrence, set the base cases, choose the
 * order of evaluation. Start top-down with memoisation if the order isn't obvious.
 */
public final class DynamicProgramming {
    private DynamicProgramming() {}

    /**
     * LC 70 Climbing Stairs (1 or 2 steps). ways(n) = ways(n - 1) + ways(n - 2): Fibonacci, so
     * only two previous values are needed.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int climbStairs(int n) {
        int prev = 1; // ways(0)
        int cur = 1; // ways(1)
        for (int i = 2; i <= n; i++) {
            int next = prev + cur;
            prev = cur;
            cur = next;
        }
        return cur;
    }

    /**
     * LC 198 House Robber. best(i) = max(skip house i, rob it + best(i - 2)).
     *
     * <p>Time O(n). Space O(1).
     */
    public static int rob(int[] nums) {
        int prev = 0;
        int cur = 0;
        for (int x : nums) {
            int next = Math.max(cur, prev + x);
            prev = cur;
            cur = next;
        }
        return cur;
    }

    /**
     * LC 62 Unique Paths in an m x n grid moving only right or down. paths[r][c] = from above +
     * from the left; one row is enough.
     *
     * <p>Time O(m * n). Space O(n).
     */
    public static int uniquePaths(int m, int n) {
        int[] row = new int[n];
        Arrays.fill(row, 1);
        for (int r = 1; r < m; r++) {
            for (int c = 1; c < n; c++) {
                row[c] += row[c - 1];
            }
        }
        return row[n - 1];
    }

    /**
     * LC 322 Coin Change (fewest coins, unlimited supply). dp[a] = 1 + min over coins of
     * dp[a - coin]. Returns -1 if the amount can't be made.
     *
     * <p>Time O(amount * coins). Space O(amount).
     */
    public static int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1); // larger than any real answer
        dp[0] = 0;
        for (int a = 1; a <= amount; a++) {
            for (int coin : coins) {
                if (coin <= a) {
                    dp[a] = Math.min(dp[a], dp[a - coin] + 1);
                }
            }
        }
        return dp[amount] > amount ? -1 : dp[amount];
    }

    /**
     * LC 300 Longest Increasing Subsequence in O(n log n). tails[i] is the smallest possible tail
     * of an increasing subsequence of length i + 1; binary search where each number fits.
     *
     * <p>Time O(n log n). Space O(n).
     */
    public static int lengthOfLIS(int[] nums) {
        int[] tails = new int[nums.length];
        int size = 0;
        for (int x : nums) {
            int lo = 0;
            int hi = size;
            while (lo < hi) {
                int mid = (lo + hi) >>> 1;
                if (tails[mid] < x) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            tails[lo] = x;
            if (lo == size) {
                size++;
            }
        }
        return size;
    }

    /**
     * LC 1143 Longest Common Subsequence. dp[i][j] for prefixes a[0..i) and b[0..j): extend the
     * diagonal on a match, otherwise drop a character from one side.
     *
     * <p>Time O(n * m). Space O(n * m).
     */
    public static int longestCommonSubsequence(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? dp[i - 1][j - 1] + 1
                        : Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        return dp[a.length()][b.length()];
    }

    /**
     * LC 72 Edit Distance (insert, delete, replace). dp[i][j] = edits to turn a[0..i) into
     * b[0..j).
     *
     * <p>Time O(n * m). Space O(n * m).
     */
    public static int minDistance(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= b.length(); j++) {
            dp[0][j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
                }
            }
        }
        return dp[a.length()][b.length()];
    }

    /**
     * 0/1 Knapsack: maximum value within the capacity, each item used at most once. Iterate the
     * capacity downwards so an item isn't counted twice in the 1-D table.
     *
     * <p>Time O(items * capacity). Space O(capacity).
     */
    public static int knapsack(int[] weights, int[] values, int capacity) {
        int[] dp = new int[capacity + 1];
        for (int i = 0; i < weights.length; i++) {
            for (int c = capacity; c >= weights[i]; c--) {
                dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
            }
        }
        return dp[capacity];
    }
}

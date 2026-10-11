package dsa;

import dsa.dp.DynamicProgramming;

final class DynamicProgrammingTest {
    static void run(Check c) {
        c.eq("climbStairs", 8, DynamicProgramming.climbStairs(5));
        c.eq("climbStairs 1", 1, DynamicProgramming.climbStairs(1));
        c.eq("rob", 12, DynamicProgramming.rob(new int[] {2, 7, 9, 3, 1}));
        c.eq("uniquePaths", 28, DynamicProgramming.uniquePaths(3, 7));
        c.eq("coinChange", 3, DynamicProgramming.coinChange(new int[] {1, 2, 5}, 11));
        c.eq("coinChange impossible", -1, DynamicProgramming.coinChange(new int[] {2}, 3));
        c.eq("coinChange zero", 0, DynamicProgramming.coinChange(new int[] {1}, 0));
        c.eq("lengthOfLIS", 4, DynamicProgramming.lengthOfLIS(new int[] {10, 9, 2, 5, 3, 7, 101, 18}));
        c.eq("lengthOfLIS equal", 1, DynamicProgramming.lengthOfLIS(new int[] {7, 7, 7, 7}));
        c.eq("longestCommonSubsequence", 3, DynamicProgramming.longestCommonSubsequence("abcde", "ace"));
        c.eq("minDistance", 3, DynamicProgramming.minDistance("horse", "ros"));
        c.eq("minDistance 2", 5, DynamicProgramming.minDistance("intention", "execution"));
        c.eq("knapsack", 9, DynamicProgramming.knapsack(new int[] {1, 3, 4, 5}, new int[] {1, 4, 5, 7}, 7));
    }
}

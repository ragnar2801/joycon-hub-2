package dsa;

import dsa.greedy.GreedyProblems;

final class GreedyTest {
    static void run(Check c) {
        c.isTrue("canJump", GreedyProblems.canJump(new int[] {2, 3, 1, 1, 4}));
        c.isFalse("canJump stuck", GreedyProblems.canJump(new int[] {3, 2, 1, 0, 4}));
        c.eq("jump", 2, GreedyProblems.jump(new int[] {2, 3, 1, 1, 4}));
        c.eq("jump single", 0, GreedyProblems.jump(new int[] {0}));
        c.eq("merge", new int[][] {{1, 6}, {8, 10}, {15, 18}},
                GreedyProblems.merge(new int[][] {{8, 10}, {1, 3}, {15, 18}, {2, 6}}));
        c.eq("merge touching", new int[][] {{1, 5}}, GreedyProblems.merge(new int[][] {{1, 4}, {4, 5}}));
        c.eq("eraseOverlapIntervals", 1,
                GreedyProblems.eraseOverlapIntervals(new int[][] {{1, 2}, {2, 3}, {3, 4}, {1, 3}}));
        c.eq("eraseOverlapIntervals all same", 2,
                GreedyProblems.eraseOverlapIntervals(new int[][] {{1, 2}, {1, 2}, {1, 2}}));
    }
}

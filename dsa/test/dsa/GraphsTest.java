package dsa;

import dsa.graphs.GraphProblems;

final class GraphsTest {
    static void run(Check c) {
        char[][] grid = {
            "11000".toCharArray(),
            "11000".toCharArray(),
            "00100".toCharArray(),
            "00011".toCharArray(),
        };
        c.eq("numIslands", 3, GraphProblems.numIslands(grid));
        c.isTrue("canFinish", GraphProblems.canFinish(2, new int[][] {{1, 0}}));
        c.isFalse("canFinish cycle", GraphProblems.canFinish(2, new int[][] {{1, 0}, {0, 1}}));
        c.eq("networkDelayTime", 2,
                GraphProblems.networkDelayTime(new int[][] {{2, 1, 1}, {2, 3, 1}, {3, 4, 1}}, 4, 2));
        c.eq("networkDelayTime shorter detour", 3,
                GraphProblems.networkDelayTime(new int[][] {{1, 2, 10}, {1, 3, 1}, {3, 2, 2}}, 3, 1));
        c.eq("networkDelayTime unreachable", -1, GraphProblems.networkDelayTime(new int[][] {{1, 2, 1}}, 2, 2));
        c.eq("countComponents", 2, GraphProblems.countComponents(5, new int[][] {{0, 1}, {1, 2}, {3, 4}}));
        c.eq("countComponents one", 1,
                GraphProblems.countComponents(5, new int[][] {{0, 1}, {1, 2}, {2, 3}, {3, 4}}));
    }
}

package dsa;

import dsa.backtracking.BacktrackingProblems;
import java.util.List;

final class BacktrackingTest {
    static void run(Check c) {
        c.eq("subsets",
                List.of(List.of(), List.of(1), List.of(1, 2), List.of(1, 2, 3), List.of(1, 3), List.of(2),
                        List.of(2, 3), List.of(3)),
                BacktrackingProblems.subsets(new int[] {1, 2, 3}));
        c.eq("permute",
                List.of(List.of(1, 2, 3), List.of(1, 3, 2), List.of(2, 1, 3), List.of(2, 3, 1), List.of(3, 1, 2),
                        List.of(3, 2, 1)),
                BacktrackingProblems.permute(new int[] {1, 2, 3}));
        c.eq("combinationSum", List.of(List.of(2, 2, 3), List.of(7)),
                BacktrackingProblems.combinationSum(new int[] {2, 3, 6, 7}, 7));
        c.eq("combinationSum none", List.of(), BacktrackingProblems.combinationSum(new int[] {2}, 1));
        c.eq("totalNQueens 4", 2, BacktrackingProblems.totalNQueens(4));
        c.eq("totalNQueens 8", 92, BacktrackingProblems.totalNQueens(8));
    }
}

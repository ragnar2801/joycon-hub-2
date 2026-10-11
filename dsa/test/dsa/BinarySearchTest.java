package dsa;

import dsa.binarysearch.BinarySearchProblems;

final class BinarySearchTest {
    static void run(Check c) {
        int[] sorted = {-1, 0, 3, 5, 9, 12};
        c.eq("search", 4, BinarySearchProblems.search(sorted, 9));
        c.eq("search missing", -1, BinarySearchProblems.search(sorted, 2));
        c.eq("searchRange", new int[] {3, 4}, BinarySearchProblems.searchRange(new int[] {5, 7, 7, 8, 8, 10}, 8));
        c.eq("searchRange missing", new int[] {-1, -1},
                BinarySearchProblems.searchRange(new int[] {5, 7, 7, 8, 8, 10}, 6));
        c.eq("searchRange max int", new int[] {1, 1},
                BinarySearchProblems.searchRange(new int[] {1, Integer.MAX_VALUE}, Integer.MAX_VALUE));
        c.eq("searchRotated", 4, BinarySearchProblems.searchRotated(new int[] {4, 5, 6, 7, 0, 1, 2}, 0));
        c.eq("searchRotated missing", -1, BinarySearchProblems.searchRotated(new int[] {4, 5, 6, 7, 0, 1, 2}, 3));
        c.eq("searchRotated single", -1, BinarySearchProblems.searchRotated(new int[] {1}, 0));
        c.eq("minEatingSpeed", 4, BinarySearchProblems.minEatingSpeed(new int[] {3, 6, 7, 11}, 8));
        c.eq("minEatingSpeed 2", 23, BinarySearchProblems.minEatingSpeed(new int[] {30, 11, 23, 4, 20}, 6));
    }
}

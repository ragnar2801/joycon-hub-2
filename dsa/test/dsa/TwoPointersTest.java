package dsa;

import dsa.twopointers.TwoPointerProblems;
import java.util.List;

final class TwoPointersTest {
    static void run(Check c) {
        int[] nums = {0, 0, 1, 1, 1, 2, 2, 3, 3, 4};
        int k = TwoPointerProblems.removeDuplicates(nums);
        c.eq("removeDuplicates count", 5, k);
        c.eq("removeDuplicates prefix", new int[] {0, 1, 2, 3, 4}, java.util.Arrays.copyOf(nums, k));
        c.eq("threeSum", List.of(List.of(-1, -1, 2), List.of(-1, 0, 1)),
                TwoPointerProblems.threeSum(new int[] {-1, 0, 1, 2, -1, -4}));
        c.eq("threeSum zeros", List.of(List.of(0, 0, 0)), TwoPointerProblems.threeSum(new int[] {0, 0, 0, 0}));
        c.eq("maxArea", 49, TwoPointerProblems.maxArea(new int[] {1, 8, 6, 2, 5, 4, 8, 3, 7}));
        c.eq("trap", 6, TwoPointerProblems.trap(new int[] {0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1}));
        c.eq("trap 2", 9, TwoPointerProblems.trap(new int[] {4, 2, 0, 3, 2, 5}));
    }
}

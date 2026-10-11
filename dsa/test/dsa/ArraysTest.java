package dsa;

import dsa.arrays.ArrayProblems;

final class ArraysTest {
    static void run(Check c) {
        c.eq("maxSubArray", 6, ArrayProblems.maxSubArray(new int[] {-2, 1, -3, 4, -1, 2, 1, -5, 4}));
        c.eq("maxSubArray all negative", -1, ArrayProblems.maxSubArray(new int[] {-3, -1, -2}));
        c.eq("maxProfit", 5, ArrayProblems.maxProfit(new int[] {7, 1, 5, 3, 6, 4}));
        c.eq("maxProfit falling", 0, ArrayProblems.maxProfit(new int[] {7, 6, 4, 3, 1}));
        c.eq("productExceptSelf", new int[] {24, 12, 8, 6},
                ArrayProblems.productExceptSelf(new int[] {1, 2, 3, 4}));
        c.eq("productExceptSelf with zero", new int[] {0, 0, 9, 0, 0},
                ArrayProblems.productExceptSelf(new int[] {-1, 1, 0, -3, 3}));
        int[] nums = {1, 2, 3, 4, 5, 6, 7};
        ArrayProblems.rotate(nums, 3);
        c.eq("rotate", new int[] {5, 6, 7, 1, 2, 3, 4}, nums);
        int[] wrap = {1, 2};
        ArrayProblems.rotate(wrap, 3);
        c.eq("rotate k > n", new int[] {2, 1}, wrap);
    }
}

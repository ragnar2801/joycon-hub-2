package dsa.twopointers;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Two pointers: usually on a sorted array, moving inwards from both ends or fast/slow. */
public final class TwoPointerProblems {
    private TwoPointerProblems() {}

    /**
     * LC 26 Remove Duplicates from Sorted Array, in place. A slow pointer marks the end of the
     * unique prefix; a fast pointer scans ahead. Returns the number of unique values.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int removeDuplicates(int[] nums) {
        if (nums.length == 0) {
            return 0;
        }
        int slow = 0;
        for (int fast = 1; fast < nums.length; fast++) {
            if (nums[fast] != nums[slow]) {
                nums[++slow] = nums[fast];
            }
        }
        return slow + 1;
    }

    /**
     * LC 15 3Sum. Sort, fix the first number, then find pairs with two pointers. Skip equal
     * values to avoid duplicate triplets.
     *
     * <p>Time O(n^2). Space O(1) besides sorting and the output.
     */
    public static List<List<Integer>> threeSum(int[] nums) {
        int[] a = nums.clone();
        Arrays.sort(a);
        List<List<Integer>> out = new ArrayList<>();
        for (int i = 0; i < a.length - 2 && a[i] <= 0; i++) {
            if (i > 0 && a[i] == a[i - 1]) {
                continue;
            }
            int lo = i + 1;
            int hi = a.length - 1;
            while (lo < hi) {
                int sum = a[i] + a[lo] + a[hi];
                if (sum < 0) {
                    lo++;
                } else if (sum > 0) {
                    hi--;
                } else {
                    out.add(List.of(a[i], a[lo], a[hi]));
                    while (lo < hi && a[lo] == a[lo + 1]) {
                        lo++;
                    }
                    while (lo < hi && a[hi] == a[hi - 1]) {
                        hi--;
                    }
                    lo++;
                    hi--;
                }
            }
        }
        return out;
    }

    /**
     * LC 11 Container With Most Water. Start with the widest container and move the shorter wall
     * inwards: moving the taller one can never help, since the shorter wall caps the height.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int maxArea(int[] height) {
        int lo = 0;
        int hi = height.length - 1;
        int best = 0;
        while (lo < hi) {
            best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
            if (height[lo] < height[hi]) {
                lo++;
            } else {
                hi--;
            }
        }
        return best;
    }

    /**
     * LC 42 Trapping Rain Water. Water above a bar is min(maxLeft, maxRight) - height. Process the
     * side with the lower wall: its max on that side is the binding limit.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int trap(int[] height) {
        int lo = 0;
        int hi = height.length - 1;
        int leftMax = 0;
        int rightMax = 0;
        int water = 0;
        while (lo < hi) {
            if (height[lo] < height[hi]) {
                leftMax = Math.max(leftMax, height[lo]);
                water += leftMax - height[lo++];
            } else {
                rightMax = Math.max(rightMax, height[hi]);
                water += rightMax - height[hi--];
            }
        }
        return water;
    }
}

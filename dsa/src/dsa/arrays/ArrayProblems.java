package dsa.arrays;

/** Array basics: single scans, prefix/suffix passes and in-place tricks. */
public final class ArrayProblems {
    private ArrayProblems() {}

    /**
     * LC 53 Maximum Subarray. Kadane's algorithm: the best sum ending at i is either nums[i] alone
     * or nums[i] added to the best sum ending at i - 1.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int maxSubArray(int[] nums) {
        int best = nums[0];
        int current = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            best = Math.max(best, current);
        }
        return best;
    }

    /**
     * LC 121 Best Time to Buy and Sell Stock. Track the cheapest price so far; selling today earns
     * price - cheapest.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int maxProfit(int[] prices) {
        int cheapest = Integer.MAX_VALUE;
        int best = 0;
        for (int p : prices) {
            cheapest = Math.min(cheapest, p);
            best = Math.max(best, p - cheapest);
        }
        return best;
    }

    /**
     * LC 238 Product of Array Except Self, without division. First pass stores the product of
     * everything to the left; second pass multiplies in the product of everything to the right.
     *
     * <p>Time O(n). Space O(1) besides the output.
     */
    public static int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] out = new int[n];
        out[0] = 1;
        for (int i = 1; i < n; i++) {
            out[i] = out[i - 1] * nums[i - 1];
        }
        int right = 1;
        for (int i = n - 1; i >= 0; i--) {
            out[i] *= right;
            right *= nums[i];
        }
        return out;
    }

    /**
     * LC 189 Rotate Array right by k. Reverse the whole array, then reverse the first k and the
     * remaining n - k elements.
     *
     * <p>Time O(n). Space O(1).
     */
    public static void rotate(int[] nums, int k) {
        int n = nums.length;
        k %= n;
        reverse(nums, 0, n - 1);
        reverse(nums, 0, k - 1);
        reverse(nums, k, n - 1);
    }

    private static void reverse(int[] a, int i, int j) {
        while (i < j) {
            int t = a[i];
            a[i++] = a[j];
            a[j--] = t;
        }
    }
}

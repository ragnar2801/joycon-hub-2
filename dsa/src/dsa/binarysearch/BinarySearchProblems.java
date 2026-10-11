package dsa.binarysearch;

/**
 * Binary search: halve the search space each step. Works on any monotonic yes/no question, not
 * just sorted arrays ("binary search on the answer").
 */
public final class BinarySearchProblems {
    private BinarySearchProblems() {}

    /**
     * LC 704 Binary Search. Returns the index of target, or -1.
     *
     * <p>Time O(log n). Space O(1).
     */
    public static int search(int[] nums, int target) {
        int lo = 0;
        int hi = nums.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1; // unsigned shift avoids int overflow
            if (nums[mid] == target) {
                return mid;
            } else if (nums[mid] < target) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return -1;
    }

    /** First index whose value is >= target (nums.length if none). */
    public static int lowerBound(int[] nums, int target) {
        int lo = 0;
        int hi = nums.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (nums[mid] < target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /** First index whose value is > target (nums.length if none). */
    public static int upperBound(int[] nums, int target) {
        int lo = 0;
        int hi = nums.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (nums[mid] <= target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /**
     * LC 34 Find First and Last Position of Element in Sorted Array.
     *
     * <p>Time O(log n). Space O(1).
     */
    public static int[] searchRange(int[] nums, int target) {
        int first = lowerBound(nums, target);
        if (first == nums.length || nums[first] != target) {
            return new int[] {-1, -1};
        }
        return new int[] {first, upperBound(nums, target) - 1};
    }

    /**
     * LC 33 Search in Rotated Sorted Array (distinct values). One half around mid is always
     * sorted; check whether the target lies inside that half.
     *
     * <p>Time O(log n). Space O(1).
     */
    public static int searchRotated(int[] nums, int target) {
        int lo = 0;
        int hi = nums.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (nums[mid] == target) {
                return mid;
            }
            if (nums[lo] <= nums[mid]) { // left half sorted
                if (nums[lo] <= target && target < nums[mid]) {
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            } else { // right half sorted
                if (nums[mid] < target && target <= nums[hi]) {
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
        }
        return -1;
    }

    /**
     * LC 875 Koko Eating Bananas. Binary search on the answer: "can she finish at speed k within
     * h hours?" is false then true as k grows, so find the first true.
     *
     * <p>Time O(n log max). Space O(1).
     */
    public static int minEatingSpeed(int[] piles, int h) {
        int lo = 1;
        int hi = 0;
        for (int p : piles) {
            hi = Math.max(hi, p);
        }
        while (lo < hi) {
            int k = (lo + hi) >>> 1;
            long hours = 0;
            for (int p : piles) {
                hours += (p + k - 1) / k; // ceil(p / k)
            }
            if (hours <= h) {
                hi = k;
            } else {
                lo = k + 1;
            }
        }
        return lo;
    }
}

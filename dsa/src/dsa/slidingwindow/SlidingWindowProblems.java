package dsa.slidingwindow;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;

/**
 * Sliding window: grow the right edge, shrink the left edge while the window is invalid (or
 * valid, for "minimum" problems). Each index enters and leaves once, so O(n).
 */
public final class SlidingWindowProblems {
    private SlidingWindowProblems() {}

    /**
     * LC 3 Longest Substring Without Repeating Characters. Remember where each character was last
     * seen and jump the left edge past a repeat.
     *
     * <p>Time O(n). Space O(alphabet).
     */
    public static int lengthOfLongestSubstring(String s) {
        int[] last = new int[128];
        Arrays.fill(last, -1);
        int left = 0;
        int best = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            left = Math.max(left, last[c] + 1);
            last[c] = right;
            best = Math.max(best, right - left + 1);
        }
        return best;
    }

    /**
     * LC 209 Minimum Size Subarray Sum (positive numbers). Shrink from the left while the sum is
     * still at least target. Returns 0 if no window qualifies.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int minSubArrayLen(int target, int[] nums) {
        int left = 0;
        int sum = 0;
        int best = Integer.MAX_VALUE;
        for (int right = 0; right < nums.length; right++) {
            sum += nums[right];
            while (sum >= target) {
                best = Math.min(best, right - left + 1);
                sum -= nums[left++];
            }
        }
        return best == Integer.MAX_VALUE ? 0 : best;
    }

    /**
     * LC 76 Minimum Window Substring. need[c] counts characters still owed; missing counts how
     * many in total. When missing hits 0 the window covers t, so shrink it as far as possible.
     *
     * <p>Time O(|s| + |t|). Space O(alphabet).
     */
    public static String minWindow(String s, String t) {
        int[] need = new int[128];
        for (char c : t.toCharArray()) {
            need[c]++;
        }
        int missing = t.length();
        int left = 0;
        int bestStart = 0;
        int bestLen = Integer.MAX_VALUE;
        for (int right = 0; right < s.length(); right++) {
            if (need[s.charAt(right)]-- > 0) {
                missing--;
            }
            while (missing == 0) {
                if (right - left + 1 < bestLen) {
                    bestLen = right - left + 1;
                    bestStart = left;
                }
                if (++need[s.charAt(left++)] > 0) {
                    missing++;
                }
            }
        }
        return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen);
    }

    /**
     * LC 239 Sliding Window Maximum. Keep a deque of indices whose values are decreasing; the
     * front is the window's max. Drop smaller values from the back (they can never be a max
     * again) and expired indices from the front.
     *
     * <p>Time O(n). Space O(k).
     */
    public static int[] maxSlidingWindow(int[] nums, int k) {
        int[] out = new int[nums.length - k + 1];
        Deque<Integer> deque = new ArrayDeque<>();
        for (int i = 0; i < nums.length; i++) {
            if (!deque.isEmpty() && deque.peekFirst() <= i - k) {
                deque.pollFirst();
            }
            while (!deque.isEmpty() && nums[deque.peekLast()] <= nums[i]) {
                deque.pollLast();
            }
            deque.addLast(i);
            if (i >= k - 1) {
                out[i - k + 1] = nums[deque.peekFirst()];
            }
        }
        return out;
    }
}

package dsa.greedy;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Greedy algorithms and intervals: make the locally best choice and argue it never hurts.
 * Interval problems almost always start by sorting on start or end.
 */
public final class GreedyProblems {
    private GreedyProblems() {}

    /**
     * LC 55 Jump Game. Track the farthest reachable index; fail if we ever stand beyond it.
     *
     * <p>Time O(n). Space O(1).
     */
    public static boolean canJump(int[] nums) {
        int reach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > reach) {
                return false;
            }
            reach = Math.max(reach, i + nums[i]);
        }
        return true;
    }

    /**
     * LC 45 Jump Game II (minimum jumps; the end is reachable). Implicit BFS: each jump covers
     * the range [start, end]; the next range ends at the farthest index reachable from it.
     *
     * <p>Time O(n). Space O(1).
     */
    public static int jump(int[] nums) {
        int jumps = 0;
        int end = 0;
        int farthest = 0;
        for (int i = 0; i < nums.length - 1; i++) {
            farthest = Math.max(farthest, i + nums[i]);
            if (i == end) {
                jumps++;
                end = farthest;
            }
        }
        return jumps;
    }

    /**
     * LC 56 Merge Intervals. Sort by start; an interval overlaps the last merged one exactly when
     * it starts before that one ends.
     *
     * <p>Time O(n log n). Space O(n).
     */
    public static int[][] merge(int[][] intervals) {
        int[][] sorted = intervals.clone();
        Arrays.sort(sorted, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] iv : sorted) {
            if (!out.isEmpty() && iv[0] <= out.get(out.size() - 1)[1]) {
                int[] last = out.get(out.size() - 1);
                last[1] = Math.max(last[1], iv[1]);
            } else {
                out.add(new int[] {iv[0], iv[1]});
            }
        }
        return out.toArray(new int[0][]);
    }

    /**
     * LC 435 Non-overlapping Intervals: fewest removals so the rest don't overlap. Sort by end
     * and keep every interval that starts after the last kept one ends; keeping the earliest end
     * leaves the most room.
     *
     * <p>Time O(n log n). Space O(n) for the sorted copy.
     */
    public static int eraseOverlapIntervals(int[][] intervals) {
        int[][] sorted = intervals.clone();
        Arrays.sort(sorted, (a, b) -> Integer.compare(a[1], b[1]));
        int kept = 0;
        long lastEnd = Long.MIN_VALUE;
        for (int[] iv : sorted) {
            if (iv[0] >= lastEnd) {
                kept++;
                lastEnd = iv[1];
            }
        }
        return intervals.length - kept;
    }
}

package dsa.hashing;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Hash maps and sets: trade memory for O(1) lookups. */
public final class HashingProblems {
    private HashingProblems() {}

    /**
     * LC 1 Two Sum. For each number, check whether its complement was already seen.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>(); // value -> index
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) {
                return new int[] {j, i};
            }
            seen.put(nums[i], i);
        }
        return new int[] {-1, -1};
    }

    /**
     * LC 49 Group Anagrams. Anagrams share the same sorted letters, so use that as the map key.
     * Groups come out in order of first appearance.
     *
     * <p>Time O(n * k log k) for n words of length k. Space O(n * k).
     */
    public static List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String s : strs) {
            char[] chars = s.toCharArray();
            Arrays.sort(chars);
            groups.computeIfAbsent(new String(chars), k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }

    /**
     * LC 128 Longest Consecutive Sequence in O(n). Only start counting from numbers that begin a
     * run (x - 1 is absent), so each number is visited at most twice.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int x : nums) {
            set.add(x);
        }
        int best = 0;
        for (int x : set) {
            if (!set.contains(x - 1)) {
                int length = 1;
                while (set.contains(x + length)) {
                    length++;
                }
                best = Math.max(best, length);
            }
        }
        return best;
    }

    /**
     * LC 560 Subarray Sum Equals K. A subarray (i, j] sums to k exactly when prefix[j] - prefix[i]
     * == k, so count how many earlier prefixes equal prefix[j] - k. Works with negative numbers,
     * unlike a sliding window.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> prefixCount = new HashMap<>();
        prefixCount.put(0, 1);
        int sum = 0;
        int count = 0;
        for (int x : nums) {
            sum += x;
            count += prefixCount.getOrDefault(sum - k, 0);
            prefixCount.merge(sum, 1, Integer::sum);
        }
        return count;
    }
}

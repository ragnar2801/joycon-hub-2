package dsa;

import dsa.hashing.HashingProblems;
import java.util.List;

final class HashingTest {
    static void run(Check c) {
        c.eq("twoSum", new int[] {0, 1}, HashingProblems.twoSum(new int[] {2, 7, 11, 15}, 9));
        c.eq("twoSum duplicates", new int[] {0, 1}, HashingProblems.twoSum(new int[] {3, 3}, 6));
        c.eq("groupAnagrams",
                List.of(List.of("eat", "tea", "ate"), List.of("tan", "nat"), List.of("bat")),
                HashingProblems.groupAnagrams(new String[] {"eat", "tea", "tan", "ate", "nat", "bat"}));
        c.eq("longestConsecutive", 4, HashingProblems.longestConsecutive(new int[] {100, 4, 200, 1, 3, 2}));
        c.eq("longestConsecutive empty", 0, HashingProblems.longestConsecutive(new int[] {}));
        c.eq("subarraySum", 2, HashingProblems.subarraySum(new int[] {1, 1, 1}, 2));
        c.eq("subarraySum negatives", 3, HashingProblems.subarraySum(new int[] {1, -1, 0}, 0));
    }
}

package dsa;

import dsa.slidingwindow.SlidingWindowProblems;

final class SlidingWindowTest {
    static void run(Check c) {
        c.eq("lengthOfLongestSubstring", 3, SlidingWindowProblems.lengthOfLongestSubstring("abcabcbb"));
        c.eq("lengthOfLongestSubstring same", 1, SlidingWindowProblems.lengthOfLongestSubstring("bbbbb"));
        c.eq("lengthOfLongestSubstring pwwkew", 3, SlidingWindowProblems.lengthOfLongestSubstring("pwwkew"));
        c.eq("lengthOfLongestSubstring abba", 2, SlidingWindowProblems.lengthOfLongestSubstring("abba"));
        c.eq("lengthOfLongestSubstring empty", 0, SlidingWindowProblems.lengthOfLongestSubstring(""));
        c.eq("minSubArrayLen", 2, SlidingWindowProblems.minSubArrayLen(7, new int[] {2, 3, 1, 2, 4, 3}));
        c.eq("minSubArrayLen none", 0, SlidingWindowProblems.minSubArrayLen(11, new int[] {1, 1, 1, 1}));
        c.eq("minWindow", "BANC", SlidingWindowProblems.minWindow("ADOBECODEBANC", "ABC"));
        c.eq("minWindow impossible", "", SlidingWindowProblems.minWindow("a", "aa"));
        c.eq("maxSlidingWindow", new int[] {3, 3, 5, 5, 6, 7},
                SlidingWindowProblems.maxSlidingWindow(new int[] {1, 3, -1, -3, 5, 3, 6, 7}, 3));
    }
}

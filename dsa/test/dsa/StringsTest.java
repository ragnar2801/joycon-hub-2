package dsa;

import dsa.strings.StringProblems;

final class StringsTest {
    static void run(Check c) {
        c.isTrue("isPalindrome", StringProblems.isPalindrome("A man, a plan, a canal: Panama"));
        c.isFalse("isPalindrome no", StringProblems.isPalindrome("race a car"));
        c.isTrue("isPalindrome blank", StringProblems.isPalindrome(" "));
        c.isTrue("isAnagram", StringProblems.isAnagram("anagram", "nagaram"));
        c.isFalse("isAnagram no", StringProblems.isAnagram("rat", "car"));
        c.eq("longestCommonPrefix", "fl",
                StringProblems.longestCommonPrefix(new String[] {"flower", "flow", "flight"}));
        c.eq("longestCommonPrefix none", "",
                StringProblems.longestCommonPrefix(new String[] {"dog", "racecar", "car"}));
        c.eq("reverseWords", "world hello", StringProblems.reverseWords("  hello   world  "));
        c.eq("strStr", 0, StringProblems.strStr("sadbutsad", "sad"));
        c.eq("strStr missing", -1, StringProblems.strStr("leetcode", "leeto"));
        c.eq("strStr overlap", 3, StringProblems.strStr("abcabcabd", "abcabd"));
        c.eq("strStr fallback", 4, StringProblems.strStr("aaaaab", "ab"));
    }
}

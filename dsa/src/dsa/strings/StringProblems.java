package dsa.strings;

/** String problems: two-pointer scans, counting and pattern matching. */
public final class StringProblems {
    private StringProblems() {}

    /**
     * LC 125 Valid Palindrome, ignoring case and anything that isn't a letter or digit. Two
     * pointers walk inwards, skipping other characters.
     *
     * <p>Time O(n). Space O(1).
     */
    public static boolean isPalindrome(String s) {
        int i = 0;
        int j = s.length() - 1;
        while (i < j) {
            if (!Character.isLetterOrDigit(s.charAt(i))) {
                i++;
            } else if (!Character.isLetterOrDigit(s.charAt(j))) {
                j--;
            } else if (Character.toLowerCase(s.charAt(i++)) != Character.toLowerCase(s.charAt(j--))) {
                return false;
            }
        }
        return true;
    }

    /**
     * LC 242 Valid Anagram (lowercase English letters). Count letters up for s and down for t;
     * every count must end at zero.
     *
     * <p>Time O(n). Space O(1) (26 counters).
     */
    public static boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) {
            return false;
        }
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) {
            if (c != 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * LC 14 Longest Common Prefix. Compare column by column until a string ends or differs.
     *
     * <p>Time O(total characters). Space O(1).
     */
    public static String longestCommonPrefix(String[] strs) {
        if (strs.length == 0) {
            return "";
        }
        for (int col = 0; col < strs[0].length(); col++) {
            char c = strs[0].charAt(col);
            for (String s : strs) {
                if (col == s.length() || s.charAt(col) != c) {
                    return strs[0].substring(0, col);
                }
            }
        }
        return strs[0];
    }

    /**
     * LC 151 Reverse Words in a String. Trim, split on runs of spaces, join in reverse order.
     *
     * <p>Time O(n). Space O(n).
     */
    public static String reverseWords(String s) {
        String[] words = s.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            sb.append(words[i]);
            if (i > 0) {
                sb.append(' ');
            }
        }
        return sb.toString();
    }

    /**
     * LC 28 Find the Index of the First Occurrence (strStr) with KMP. lps[i] is the length of the
     * longest proper prefix of pat[0..i] that is also a suffix; on a mismatch we jump back using
     * it instead of restarting, so the text pointer never moves backwards.
     *
     * <p>Time O(n + m). Space O(m).
     */
    public static int strStr(String text, String pat) {
        if (pat.isEmpty()) {
            return 0;
        }
        int[] lps = new int[pat.length()];
        for (int i = 1, len = 0; i < pat.length(); ) {
            if (pat.charAt(i) == pat.charAt(len)) {
                lps[i++] = ++len;
            } else if (len > 0) {
                len = lps[len - 1];
            } else {
                lps[i++] = 0;
            }
        }
        for (int i = 0, j = 0; i < text.length(); ) {
            if (text.charAt(i) == pat.charAt(j)) {
                i++;
                j++;
                if (j == pat.length()) {
                    return i - j;
                }
            } else if (j > 0) {
                j = lps[j - 1];
            } else {
                i++;
            }
        }
        return -1;
    }
}

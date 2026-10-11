package dsa.stacks;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Stacks: matching pairs, expression evaluation and monotonic stacks ("next greater/smaller
 * element"). In Java use ArrayDeque, not the legacy Stack class.
 */
public final class StackProblems {
    private StackProblems() {}

    /**
     * LC 20 Valid Parentheses. Push the closer we expect; each closer must match the top.
     *
     * <p>Time O(n). Space O(n).
     */
    public static boolean isValid(String s) {
        Deque<Character> expected = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '(' -> expected.push(')');
                case '[' -> expected.push(']');
                case '{' -> expected.push('}');
                default -> {
                    if (expected.isEmpty() || expected.pop() != c) {
                        return false;
                    }
                }
            }
        }
        return expected.isEmpty();
    }

    /**
     * LC 150 Evaluate Reverse Polish Notation. Numbers are pushed; an operator pops two operands
     * (right one first) and pushes the result.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();
        for (String t : tokens) {
            switch (t) {
                case "+" -> stack.push(stack.pop() + stack.pop());
                case "*" -> stack.push(stack.pop() * stack.pop());
                case "-" -> {
                    int b = stack.pop();
                    stack.push(stack.pop() - b);
                }
                case "/" -> {
                    int b = stack.pop();
                    stack.push(stack.pop() / b);
                }
                default -> stack.push(Integer.parseInt(t));
            }
        }
        return stack.pop();
    }

    /**
     * LC 739 Daily Temperatures. Monotonic stack of indices still waiting for a warmer day; a
     * warmer day resolves everything colder on top of the stack.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int[] dailyTemperatures(int[] temps) {
        int[] wait = new int[temps.length];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < temps.length; i++) {
            while (!stack.isEmpty() && temps[stack.peek()] < temps[i]) {
                int j = stack.pop();
                wait[j] = i - j;
            }
            stack.push(i);
        }
        return wait;
    }

    /**
     * LC 84 Largest Rectangle in Histogram. Keep bars in increasing height. When a lower bar
     * arrives, each popped bar's rectangle spans from the new stack top (exclusive) to i
     * (exclusive). A sentinel height 0 at the end flushes the stack.
     *
     * <p>Time O(n). Space O(n).
     */
    public static int largestRectangleArea(int[] heights) {
        Deque<Integer> stack = new ArrayDeque<>();
        int best = 0;
        for (int i = 0; i <= heights.length; i++) {
            int h = i == heights.length ? 0 : heights[i];
            while (!stack.isEmpty() && heights[stack.peek()] >= h) {
                int height = heights[stack.pop()];
                int left = stack.isEmpty() ? -1 : stack.peek();
                best = Math.max(best, height * (i - left - 1));
            }
            stack.push(i);
        }
        return best;
    }
}

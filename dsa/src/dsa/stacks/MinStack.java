package dsa.stacks;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * LC 155 Min Stack. Each entry also stores the minimum at the time it was pushed, so getMin is
 * O(1) and stays correct after pops.
 */
public class MinStack {
    private final Deque<int[]> stack = new ArrayDeque<>(); // {value, min so far}

    public void push(int val) {
        int min = stack.isEmpty() ? val : Math.min(val, stack.peek()[1]);
        stack.push(new int[] {val, min});
    }

    public void pop() {
        stack.pop();
    }

    public int top() {
        return stack.peek()[0];
    }

    public int getMin() {
        return stack.peek()[1];
    }
}

package dsa;

import dsa.stacks.MinStack;
import dsa.stacks.StackProblems;

final class StacksTest {
    static void run(Check c) {
        c.isTrue("isValid", StackProblems.isValid("()[]{}"));
        c.isTrue("isValid nested", StackProblems.isValid("{[()]}"));
        c.isFalse("isValid crossed", StackProblems.isValid("([)]"));
        c.isFalse("isValid unclosed", StackProblems.isValid("(("));
        c.isFalse("isValid extra closer", StackProblems.isValid(")"));
        c.eq("evalRPN", 9, StackProblems.evalRPN(new String[] {"2", "1", "+", "3", "*"}));
        c.eq("evalRPN division", 6, StackProblems.evalRPN(new String[] {"4", "13", "5", "/", "+"}));
        c.eq("dailyTemperatures", new int[] {1, 1, 4, 2, 1, 1, 0, 0},
                StackProblems.dailyTemperatures(new int[] {73, 74, 75, 71, 69, 72, 76, 73}));
        c.eq("largestRectangleArea", 10, StackProblems.largestRectangleArea(new int[] {2, 1, 5, 6, 2, 3}));
        c.eq("largestRectangleArea flat", 9, StackProblems.largestRectangleArea(new int[] {3, 3, 3}));

        MinStack stack = new MinStack();
        stack.push(-2);
        stack.push(0);
        stack.push(-3);
        c.eq("MinStack min", -3, stack.getMin());
        stack.pop();
        c.eq("MinStack top", 0, stack.top());
        c.eq("MinStack min after pop", -2, stack.getMin());
    }
}

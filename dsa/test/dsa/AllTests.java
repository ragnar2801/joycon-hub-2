package dsa;

/** Runs every topic's tests. Exits with status 1 if anything fails, so CI goes red. */
public final class AllTests {
    public static void main(String[] args) {
        Check c = new Check();
        c.suite("sorting", () -> SortingTest.run(c));
        c.suite("arrays", () -> ArraysTest.run(c));
        c.suite("strings", () -> StringsTest.run(c));
        c.suite("hashing", () -> HashingTest.run(c));
        c.suite("two pointers", () -> TwoPointersTest.run(c));
        c.suite("sliding window", () -> SlidingWindowTest.run(c));
        c.suite("binary search", () -> BinarySearchTest.run(c));
        c.suite("stacks", () -> StacksTest.run(c));
        c.suite("linked lists", () -> LinkedListTest.run(c));
        c.suite("trees and tries", () -> TreesTest.run(c));
        c.suite("heaps", () -> HeapsTest.run(c));
        c.suite("graphs", () -> GraphsTest.run(c));
        c.suite("backtracking", () -> BacktrackingTest.run(c));
        c.suite("dynamic programming", () -> DynamicProgrammingTest.run(c));
        c.suite("greedy and intervals", () -> GreedyTest.run(c));
        System.out.println(c.summary());
        if (c.failed() > 0) {
            System.exit(1);
        }
    }
}

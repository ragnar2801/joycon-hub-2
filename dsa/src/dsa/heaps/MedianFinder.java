package dsa.heaps;

import java.util.Collections;
import java.util.PriorityQueue;

/**
 * LC 295 Find Median from Data Stream. A max-heap holds the smaller half and a min-heap the
 * larger half; the lower heap may hold one extra element.
 *
 * <p>addNum O(log n). findMedian O(1).
 */
public class MedianFinder {
    private final PriorityQueue<Integer> lower = new PriorityQueue<>(Collections.reverseOrder());
    private final PriorityQueue<Integer> upper = new PriorityQueue<>();

    public void addNum(int num) {
        lower.add(num);
        upper.add(lower.poll()); // move the largest of the lower half up
        if (upper.size() > lower.size()) {
            lower.add(upper.poll()); // rebalance
        }
    }

    public double findMedian() {
        if (lower.size() > upper.size()) {
            return lower.peek();
        }
        return (lower.peek() + (double) upper.peek()) / 2;
    }
}

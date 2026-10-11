package dsa;

import static dsa.common.ListNode.of;
import static dsa.common.ListNode.toList;

import dsa.common.ListNode;
import dsa.heaps.HeapProblems;
import dsa.heaps.MedianFinder;
import java.util.List;

final class HeapsTest {
    static void run(Check c) {
        c.eq("findKthLargest", 5, HeapProblems.findKthLargest(new int[] {3, 2, 1, 5, 6, 4}, 2));
        c.eq("findKthLargest duplicates", 4, HeapProblems.findKthLargest(new int[] {3, 2, 3, 1, 2, 4, 5, 5, 6}, 4));
        c.eq("topKFrequent", new int[] {1, 2}, HeapProblems.topKFrequent(new int[] {1, 1, 1, 2, 2, 3}, 2));
        c.eq("mergeKLists", List.of(1, 1, 2, 3, 4, 4, 5, 6),
                toList(HeapProblems.mergeKLists(new ListNode[] {of(1, 4, 5), of(1, 3, 4), of(2, 6), null})));

        MedianFinder median = new MedianFinder();
        median.addNum(1);
        median.addNum(2);
        c.eq("MedianFinder even", 1.5, median.findMedian());
        median.addNum(3);
        c.eq("MedianFinder odd", 2.0, median.findMedian());
        median.addNum(-10);
        c.eq("MedianFinder negative", 1.5, median.findMedian());
    }
}

package dsa.heaps;

import dsa.common.ListNode;
import java.util.HashMap;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * Heaps (PriorityQueue): the "top k" and "merge k sorted" patterns. Java's PriorityQueue is a
 * min-heap; pass Comparator.reverseOrder() for a max-heap.
 */
public final class HeapProblems {
    private HeapProblems() {}

    /**
     * LC 215 Kth Largest Element. Keep a min-heap of the k largest seen; its top is the answer.
     *
     * <p>Time O(n log k). Space O(k).
     */
    public static int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int x : nums) {
            heap.add(x);
            if (heap.size() > k) {
                heap.poll();
            }
        }
        return heap.peek();
    }

    /**
     * LC 347 Top K Frequent Elements, most frequent first. Count, then keep a min-heap (by count)
     * of size k.
     *
     * <p>Time O(n log k). Space O(n).
     */
    public static int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : nums) {
            count.merge(x, 1, Integer::sum);
        }
        PriorityQueue<Integer> heap = new PriorityQueue<>((a, b) -> count.get(a) - count.get(b));
        for (int x : count.keySet()) {
            heap.add(x);
            if (heap.size() > k) {
                heap.poll();
            }
        }
        int[] out = new int[k];
        for (int i = k - 1; i >= 0; i--) {
            out[i] = heap.poll();
        }
        return out;
    }

    /**
     * LC 23 Merge k Sorted Lists. The heap holds the current head of each list; repeatedly take
     * the smallest and push its successor.
     *
     * <p>Time O(N log k) for N nodes in total. Space O(k).
     */
    public static ListNode mergeKLists(ListNode[] lists) {
        PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));
        for (ListNode head : lists) {
            if (head != null) {
                heap.add(head);
            }
        }
        ListNode dummy = new ListNode(0);
        ListNode tail = dummy;
        while (!heap.isEmpty()) {
            tail.next = heap.poll();
            tail = tail.next;
            if (tail.next != null) {
                heap.add(tail.next);
            }
        }
        return dummy.next;
    }
}

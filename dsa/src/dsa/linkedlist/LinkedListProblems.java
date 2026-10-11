package dsa.linkedlist;

import dsa.common.ListNode;

/**
 * Linked lists: pointer rewiring, dummy head nodes and fast/slow pointers. Draw the pointers on
 * paper before coding.
 */
public final class LinkedListProblems {
    private LinkedListProblems() {}

    /**
     * LC 206 Reverse Linked List, iteratively. Point each node back at the previous one.
     *
     * <p>Time O(n). Space O(1).
     */
    public static ListNode reverseList(ListNode head) {
        ListNode prev = null;
        while (head != null) {
            ListNode next = head.next;
            head.next = prev;
            prev = head;
            head = next;
        }
        return prev;
    }

    /**
     * LC 21 Merge Two Sorted Lists. A dummy head avoids special-casing the first node.
     *
     * <p>Time O(n + m). Space O(1).
     */
    public static ListNode mergeTwoLists(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0);
        ListNode tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) {
                tail.next = a;
                a = a.next;
            } else {
                tail.next = b;
                b = b.next;
            }
            tail = tail.next;
        }
        tail.next = a != null ? a : b;
        return dummy.next;
    }

    /**
     * LC 141 Linked List Cycle. Floyd's tortoise and hare: if there is a cycle the fast pointer
     * eventually laps the slow one.
     *
     * <p>Time O(n). Space O(1).
     */
    public static boolean hasCycle(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                return true;
            }
        }
        return false;
    }

    /**
     * LC 876 Middle of the Linked List (the second middle for even lengths). Fast moves two steps
     * for every one of slow.
     *
     * <p>Time O(n). Space O(1).
     */
    public static ListNode middleNode(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        return slow;
    }

    /**
     * LC 19 Remove Nth Node From End of List. Move a lead pointer n steps ahead, then move both
     * until the lead reaches the end; the trailing pointer is just before the node to remove.
     *
     * <p>Time O(n), one pass. Space O(1).
     */
    public static ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head);
        ListNode lead = dummy;
        ListNode trail = dummy;
        for (int i = 0; i < n; i++) {
            lead = lead.next;
        }
        while (lead.next != null) {
            lead = lead.next;
            trail = trail.next;
        }
        trail.next = trail.next.next;
        return dummy.next;
    }
}

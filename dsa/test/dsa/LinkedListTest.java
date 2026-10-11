package dsa;

import static dsa.common.ListNode.of;
import static dsa.common.ListNode.toList;

import dsa.common.ListNode;
import dsa.linkedlist.LinkedListProblems;
import java.util.List;

final class LinkedListTest {
    static void run(Check c) {
        c.eq("reverseList", List.of(5, 4, 3, 2, 1), toList(LinkedListProblems.reverseList(of(1, 2, 3, 4, 5))));
        c.eq("reverseList empty", List.of(), toList(LinkedListProblems.reverseList(null)));
        c.eq("mergeTwoLists", List.of(1, 1, 2, 3, 4, 4),
                toList(LinkedListProblems.mergeTwoLists(of(1, 2, 4), of(1, 3, 4))));
        c.eq("middleNode odd", 3, LinkedListProblems.middleNode(of(1, 2, 3, 4, 5)).val);
        c.eq("middleNode even", 4, LinkedListProblems.middleNode(of(1, 2, 3, 4, 5, 6)).val);
        c.eq("removeNthFromEnd", List.of(1, 2, 3, 5), toList(LinkedListProblems.removeNthFromEnd(of(1, 2, 3, 4, 5), 2)));
        c.eq("removeNthFromEnd head", List.of(), toList(LinkedListProblems.removeNthFromEnd(of(1), 1)));

        ListNode cyclic = of(3, 2, 0, -4);
        cyclic.next.next.next.next = cyclic.next; // tail -> node 2
        c.isTrue("hasCycle", LinkedListProblems.hasCycle(cyclic));
        c.isFalse("hasCycle none", LinkedListProblems.hasCycle(of(1, 2, 3)));
    }
}

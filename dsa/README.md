# DSA Preparation (Java)

A study plan and solved, tested classic problems for coding interviews. There are 15 topics and
about 70 problems and data structures. Every solution has a comment that explains the idea and its
time and space complexity. The tests need only the JDK.

## Run the tests

You need JDK 17 or newer.

```bash
sh dsa/run-tests.sh
```

This compiles everything with plain `javac` into `dsa/out/` and prints one line per topic:

```
ok   sorting
ok   arrays
...
145 passed, 0 failed
```

CI runs the same script on every push (the `dsa` job in `.github/workflows/ci.yml`).

## Layout

```
dsa/
├── run-tests.sh                 compile + run everything
├── src/dsa/
│   ├── common/                  ListNode, TreeNode helpers
│   ├── sorting/ arrays/ strings/ hashing/ twopointers/ slidingwindow/
│   ├── binarysearch/ stacks/ linkedlist/ trees/ heaps/ graphs/
│   └── backtracking/ dp/ greedy/
└── test/dsa/                    one <Topic>Test.java per topic, plus AllTests and Check
```

**Practice tip:** pick a problem from the tables below and solve it on LeetCode yourself before
you open the solution here. Then compare: is yours simpler, or does it miss an edge case that a
test here covers?

## 8-week roadmap

Spend about 1–2 hours a day. Each week, re-solve two problems from earlier weeks without looking.

| Week | Topics                                                   | Goal                                                    |
| ---- | -------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Big-O, arrays, strings, sorting                          | Analyse any loop's complexity; write merge/quick sort   |
| 2    | Hashing, two pointers                                    | Reach for a HashMap or a sorted scan by reflex          |
| 3    | Sliding window, binary search                            | Spot "contiguous subarray" and "monotonic answer" cues  |
| 4    | Stacks, linked lists                                     | Monotonic stack; pointer rewiring without bugs          |
| 5    | Trees, BST, tries                                        | Recursive DFS and level-order BFS from memory           |
| 6    | Heaps, graphs (BFS/DFS, topo sort, Dijkstra, union-find) | Model a problem as a graph                              |
| 7    | Backtracking, greedy and intervals                       | Choose/explore/un-choose template; sort intervals first |
| 8    | Dynamic programming, then mixed mock tests               | State + recurrence + base case; 45-minute timed sets    |

## Problems by topic

LC = LeetCode problem number.

| Topic                | Problems (LC #)                                                                                                                         | Source                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Sorting              | Merge sort, Quick sort, Counting sort, Sort Colors (75)                                                                                 | [Sorting.java](src/dsa/sorting/Sorting.java)                                                               |
| Arrays               | Maximum Subarray (53), Best Time to Buy and Sell Stock (121), Product of Array Except Self (238), Rotate Array (189)                    | [ArrayProblems.java](src/dsa/arrays/ArrayProblems.java)                                                    |
| Strings              | Valid Palindrome (125), Valid Anagram (242), Longest Common Prefix (14), Reverse Words (151), strStr with KMP (28)                      | [StringProblems.java](src/dsa/strings/StringProblems.java)                                                 |
| Hashing              | Two Sum (1), Group Anagrams (49), Longest Consecutive Sequence (128), Subarray Sum Equals K (560)                                       | [HashingProblems.java](src/dsa/hashing/HashingProblems.java)                                               |
| Two pointers         | Remove Duplicates (26), 3Sum (15), Container With Most Water (11), Trapping Rain Water (42)                                             | [TwoPointerProblems.java](src/dsa/twopointers/TwoPointerProblems.java)                                     |
| Sliding window       | Longest Substring Without Repeating (3), Minimum Size Subarray Sum (209), Minimum Window Substring (76), Sliding Window Maximum (239)   | [SlidingWindowProblems.java](src/dsa/slidingwindow/SlidingWindowProblems.java)                             |
| Binary search        | Binary Search (704), lower/upper bound, Search Range (34), Search in Rotated Array (33), Koko Eating Bananas (875)                      | [BinarySearchProblems.java](src/dsa/binarysearch/BinarySearchProblems.java)                                |
| Stacks               | Valid Parentheses (20), Evaluate RPN (150), Daily Temperatures (739), Largest Rectangle in Histogram (84), Min Stack (155)              | [StackProblems.java](src/dsa/stacks/StackProblems.java), [MinStack.java](src/dsa/stacks/MinStack.java)     |
| Linked lists         | Reverse List (206), Merge Two Sorted Lists (21), Linked List Cycle (141), Middle of List (876), Remove Nth From End (19)                | [LinkedListProblems.java](src/dsa/linkedlist/LinkedListProblems.java)                                      |
| Trees and tries      | Max Depth (104), Inorder Traversal (94), Level Order (102), Validate BST (98), Lowest Common Ancestor (236), Trie (208)                 | [TreeProblems.java](src/dsa/trees/TreeProblems.java), [Trie.java](src/dsa/trees/Trie.java)                 |
| Heaps                | Kth Largest (215), Top K Frequent (347), Merge k Sorted Lists (23), Median from Data Stream (295)                                       | [HeapProblems.java](src/dsa/heaps/HeapProblems.java), [MedianFinder.java](src/dsa/heaps/MedianFinder.java) |
| Graphs               | Number of Islands (200), Course Schedule (207), Network Delay Time / Dijkstra (743), Connected Components / Union-Find (323)            | [GraphProblems.java](src/dsa/graphs/GraphProblems.java), [UnionFind.java](src/dsa/graphs/UnionFind.java)   |
| Backtracking         | Subsets (78), Permutations (46), Combination Sum (39), N-Queens II (52)                                                                 | [BacktrackingProblems.java](src/dsa/backtracking/BacktrackingProblems.java)                                |
| Dynamic programming  | Climbing Stairs (70), House Robber (198), Unique Paths (62), Coin Change (322), LIS (300), LCS (1143), Edit Distance (72), 0/1 Knapsack | [DynamicProgramming.java](src/dsa/dp/DynamicProgramming.java)                                              |
| Greedy and intervals | Jump Game (55), Jump Game II (45), Merge Intervals (56), Non-overlapping Intervals (435)                                                | [GreedyProblems.java](src/dsa/greedy/GreedyProblems.java)                                                  |

## Pattern cheat sheet

Map clues in the problem statement to a technique.

| If the problem says…                                 | Try                                        |
| ---------------------------------------------------- | ------------------------------------------ |
| Sorted array, find a pair/triplet                    | Two pointers                               |
| Longest/shortest contiguous subarray or substring    | Sliding window                             |
| Subarray sum with negative numbers                   | Prefix sums + HashMap                      |
| "Have I seen this before?", counting, grouping       | HashMap / HashSet                          |
| Sorted input, or "minimum X such that…" is monotonic | Binary search (on the index or the answer) |
| Next greater/smaller element, matching brackets      | Stack (monotonic stack)                    |
| Top k, k-th largest, merge k sorted, running median  | Heap (PriorityQueue)                       |
| Shortest path, unweighted                            | BFS                                        |
| Shortest path, non-negative weights                  | Dijkstra                                   |
| Dependencies / ordering                              | Topological sort                           |
| Are these connected? Merging groups                  | Union-find                                 |
| All combinations / permutations / subsets            | Backtracking                               |
| Count ways, min/max cost, overlapping subproblems    | Dynamic programming                        |
| Intervals                                            | Sort by start (merge) or end (scheduling)  |
| Prefix lookups over many words                       | Trie                                       |

## Complexity reference

| Operation               | Array | ArrayList      | LinkedList   | HashMap/Set | TreeMap/Set | PriorityQueue |
| ----------------------- | ----- | -------------- | ------------ | ----------- | ----------- | ------------- |
| Access by index         | O(1)  | O(1)           | O(n)         | –           | –           | –             |
| Search                  | O(n)  | O(n)           | O(n)         | O(1) avg    | O(log n)    | O(n)          |
| Insert/remove at end    | –     | O(1) amortised | O(1)         | O(1) avg    | O(log n)    | O(log n)      |
| Insert/remove in middle | –     | O(n)           | O(1) at node | –           | –           | –             |
| Min/max                 | O(n)  | O(n)           | O(n)         | O(n)        | O(log n)    | O(1) peek     |

| Algorithm      | Best    | Average | Worst   | Space | Stable |
| -------------- | ------- | ------- | ------- | ----- | ------ |
| Merge sort     | n log n | n log n | n log n | n     | Yes    |
| Quick sort     | n log n | n log n | n²      | log n | No     |
| Heap sort      | n log n | n log n | n log n | 1     | No     |
| Insertion sort | n       | n²      | n²      | 1     | Yes    |
| Counting sort  | n + k   | n + k   | n + k   | k     | Yes    |

Rough limits for a 1-second judge (about 10⁸ simple operations):

| n       | Acceptable complexity |
| ------- | --------------------- |
| ≤ 12    | O(n!)                 |
| ≤ 25    | O(2ⁿ)                 |
| ≤ 500   | O(n³)                 |
| ≤ 5,000 | O(n²)                 |
| ≤ 10⁶   | O(n log n)            |
| ≤ 10⁸   | O(n)                  |

## Java interview tips

- Use `ArrayDeque` for stacks and queues, not `Stack` or `LinkedList`.
- `PriorityQueue` is a min-heap. Pass `Collections.reverseOrder()` for a max-heap.
- Compute the midpoint as `(lo + hi) >>> 1` or `lo + (hi - lo) / 2` to avoid int overflow.
- Compare with `Integer.compare(a, b)` in comparators, not `a - b`, which can overflow.
- Compare boxed `Integer` values with `.equals`. `==` only works reliably for -128 to 127.
- Use `long` for sums and products that can exceed about 2.1 × 10⁹.
- Use `StringBuilder` to build strings in a loop.

## In the interview

1. Restate the problem and ask about the input: size, negatives, duplicates, empty input.
2. Work through a small example by hand.
3. Say the brute force and its complexity, then improve it.
4. Code it, talking through the choices.
5. Test it with your example and the edge cases: empty, one element, all equal, very large values.
6. State the final time and space complexity.

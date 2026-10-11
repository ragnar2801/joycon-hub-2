package dsa;

import dsa.sorting.Sorting;

final class SortingTest {
    static void run(Check c) {
        int[][] inputs = {{}, {1}, {5, 2, 9, 1, 5, 6}, {3, 3, 3}, {9, 8, 7, 6, 5, 4, 3, 2, 1}, {-4, 10, 0, -4, 7}};
        for (int[] input : inputs) {
            int[] expected = input.clone();
            java.util.Arrays.sort(expected);
            int[] merge = input.clone();
            Sorting.mergeSort(merge);
            c.eq("mergeSort", expected, merge);
            int[] quick = input.clone();
            Sorting.quickSort(quick);
            c.eq("quickSort", expected, quick);
        }
        int[] counting = {4, 1, 3, 1, 0, 4};
        Sorting.countingSort(counting, 4);
        c.eq("countingSort", new int[] {0, 1, 1, 3, 4, 4}, counting);
        int[] colors = {2, 0, 2, 1, 1, 0};
        Sorting.sortColors(colors);
        c.eq("sortColors", new int[] {0, 0, 1, 1, 2, 2}, colors);
    }
}

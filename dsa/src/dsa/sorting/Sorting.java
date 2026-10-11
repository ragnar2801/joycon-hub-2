package dsa.sorting;

/** Classic sorting algorithms. Know their time, space and stability by heart. */
public final class Sorting {
    private Sorting() {}

    /**
     * Merge sort: split in half, sort each half, merge the two sorted halves.
     *
     * <p>Time O(n log n) in every case. Space O(n). Stable.
     */
    public static void mergeSort(int[] a) {
        if (a.length < 2) {
            return;
        }
        mergeSort(a, new int[a.length], 0, a.length - 1);
    }

    private static void mergeSort(int[] a, int[] tmp, int lo, int hi) {
        if (lo >= hi) {
            return;
        }
        int mid = (lo + hi) >>> 1;
        mergeSort(a, tmp, lo, mid);
        mergeSort(a, tmp, mid + 1, hi);
        int i = lo;
        int j = mid + 1;
        int k = lo;
        while (i <= mid && j <= hi) {
            tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++]; // <= keeps it stable
        }
        while (i <= mid) {
            tmp[k++] = a[i++];
        }
        while (j <= hi) {
            tmp[k++] = a[j++];
        }
        System.arraycopy(tmp, lo, a, lo, hi - lo + 1);
    }

    /**
     * Quick sort (Lomuto partition, middle element as pivot so sorted input is not a worst case).
     *
     * <p>Time O(n log n) on average, O(n^2) worst case. Space O(log n) stack on average. Not
     * stable.
     */
    public static void quickSort(int[] a) {
        quickSort(a, 0, a.length - 1);
    }

    private static void quickSort(int[] a, int lo, int hi) {
        if (lo >= hi) {
            return;
        }
        swap(a, lo + (hi - lo) / 2, hi);
        int pivot = a[hi];
        int i = lo; // everything left of i is < pivot
        for (int j = lo; j < hi; j++) {
            if (a[j] < pivot) {
                swap(a, i++, j);
            }
        }
        swap(a, i, hi);
        quickSort(a, lo, i - 1);
        quickSort(a, i + 1, hi);
    }

    /**
     * Counting sort for values in [0, max]. Beats comparison sorts when the range is small.
     *
     * <p>Time O(n + max). Space O(max).
     */
    public static void countingSort(int[] a, int max) {
        int[] count = new int[max + 1];
        for (int x : a) {
            count[x]++;
        }
        int k = 0;
        for (int v = 0; v <= max; v++) {
            while (count[v]-- > 0) {
                a[k++] = v;
            }
        }
    }

    /**
     * LC 75 Sort Colors (Dutch national flag). Sorts an array of 0s, 1s and 2s in one pass: 0s go
     * to the low end, 2s to the high end, 1s stay in the middle.
     *
     * <p>Time O(n). Space O(1).
     */
    public static void sortColors(int[] a) {
        int low = 0;
        int mid = 0;
        int high = a.length - 1;
        while (mid <= high) {
            if (a[mid] == 0) {
                swap(a, low++, mid++);
            } else if (a[mid] == 2) {
                swap(a, mid, high--); // don't advance mid: the swapped-in value is unchecked
            } else {
                mid++;
            }
        }
    }

    private static void swap(int[] a, int i, int j) {
        int t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
}

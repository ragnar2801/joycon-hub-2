package dsa.graphs;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.PriorityQueue;
import java.util.Queue;

/** Graphs: grid DFS/BFS, topological sort, shortest paths and union-find. */
public final class GraphProblems {
    private GraphProblems() {}

    private static final int[][] DIRECTIONS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    /**
     * LC 200 Number of Islands. Each unvisited '1' starts a new island; flood-fill it (here with
     * BFS, which avoids stack overflow on huge grids) by marking cells '0'. Modifies the grid.
     *
     * <p>Time O(rows * cols). Space O(min(rows, cols)) for the queue.
     */
    public static int numIslands(char[][] grid) {
        int islands = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) {
                if (grid[r][c] != '1') {
                    continue;
                }
                islands++;
                grid[r][c] = '0';
                Queue<int[]> queue = new ArrayDeque<>();
                queue.add(new int[] {r, c});
                while (!queue.isEmpty()) {
                    int[] cell = queue.poll();
                    for (int[] d : DIRECTIONS) {
                        int nr = cell[0] + d[0];
                        int nc = cell[1] + d[1];
                        if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length
                                && grid[nr][nc] == '1') {
                            grid[nr][nc] = '0';
                            queue.add(new int[] {nr, nc});
                        }
                    }
                }
            }
        }
        return islands;
    }

    /**
     * LC 207 Course Schedule. Kahn's topological sort: repeatedly take courses with no remaining
     * prerequisites. If some course is never taken, there is a cycle. prerequisites[i] = {course,
     * prerequisite}.
     *
     * <p>Time O(V + E). Space O(V + E).
     */
    public static boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> next = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) {
            next.add(new ArrayList<>());
        }
        int[] indegree = new int[numCourses];
        for (int[] p : prerequisites) {
            next.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }
        Queue<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) {
            if (indegree[i] == 0) {
                queue.add(i);
            }
        }
        int taken = 0;
        while (!queue.isEmpty()) {
            int course = queue.poll();
            taken++;
            for (int n : next.get(course)) {
                if (--indegree[n] == 0) {
                    queue.add(n);
                }
            }
        }
        return taken == numCourses;
    }

    /**
     * LC 743 Network Delay Time. Dijkstra from node k (nodes are 1..n); the answer is the
     * farthest shortest distance, or -1 if some node is unreachable. times[i] = {from, to, w}.
     *
     * <p>Time O(E log V). Space O(V + E).
     */
    public static int networkDelayTime(int[][] times, int n, int k) {
        List<List<int[]>> adj = new ArrayList<>();
        for (int i = 0; i <= n; i++) {
            adj.add(new ArrayList<>());
        }
        for (int[] t : times) {
            adj.get(t[0]).add(new int[] {t[1], t[2]});
        }
        int[] dist = new int[n + 1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[k] = 0;
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[1], b[1]));
        heap.add(new int[] {k, 0});
        while (!heap.isEmpty()) {
            int[] top = heap.poll();
            int node = top[0];
            if (top[1] > dist[node]) {
                continue; // stale entry: a shorter path was already found
            }
            for (int[] edge : adj.get(node)) {
                int d = dist[node] + edge[1];
                if (d < dist[edge[0]]) {
                    dist[edge[0]] = d;
                    heap.add(new int[] {edge[0], d});
                }
            }
        }
        int worst = 0;
        for (int i = 1; i <= n; i++) {
            if (dist[i] == Integer.MAX_VALUE) {
                return -1;
            }
            worst = Math.max(worst, dist[i]);
        }
        return worst;
    }

    /**
     * LC 323 Number of Connected Components in an Undirected Graph, with union-find. Start with
     * n components; every union of two different sets removes one.
     *
     * <p>Time O(E * α(n)), effectively O(E). Space O(n).
     */
    public static int countComponents(int n, int[][] edges) {
        UnionFind uf = new UnionFind(n);
        int components = n;
        for (int[] e : edges) {
            if (uf.union(e[0], e[1])) {
                components--;
            }
        }
        return components;
    }
}

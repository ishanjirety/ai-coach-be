/**
 * The static DSA syllabus. It is the source of truth for coverage: every
 * generated question is tagged with concept ids from here, and the report
 * scores the user against these concepts.
 *
 * Concept ids are globally unique (`<topicId>.<concept>`), so a concept can be
 * looked up without knowing its topic. The descriptions ground the question
 * generator, the coach's `explainConcept` tool and the report.
 */

export interface SyllabusConcept {
  id: string;
  name: string;
  description: string;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  description: string;
  concepts: SyllabusConcept[];
}

export const SYLLABUS: readonly SyllabusTopic[] = [
  {
    id: 'arrays-hashing',
    name: 'Arrays & Hashing',
    description:
      'Working with contiguous arrays and hash maps/sets to count, group and look up values in constant time.',
    concepts: [
      {
        id: 'arrays-hashing.array-basics',
        name: 'Array operations & complexity',
        description:
          'Arrays give O(1) access by index but O(n) insertion or deletion in the middle because elements shift. Appending to a dynamic array is amortised O(1) thanks to capacity doubling.',
      },
      {
        id: 'arrays-hashing.hash-map-lookup',
        name: 'Hash map lookups',
        description:
          'A hash map stores key/value pairs with average O(1) insert, lookup and delete. It trades memory for speed and turns "have I seen X?" from an O(n) scan into one lookup, e.g. Two Sum stores each value\'s index while scanning.',
      },
      {
        id: 'arrays-hashing.hash-set-dedup',
        name: 'Hash sets for membership & duplicates',
        description:
          'A hash set stores unique keys with O(1) average membership tests. It is the standard tool for detecting duplicates, intersecting collections, or checking whether a value exists while scanning once.',
      },
      {
        id: 'arrays-hashing.frequency-counting',
        name: 'Frequency counting',
        description:
          'Counting occurrences with a map (or a fixed array for small alphabets) answers anagram, majority-element and "top K frequent" questions. Comparing two frequency tables checks whether two collections are permutations of each other.',
      },
      {
        id: 'arrays-hashing.grouping-by-key',
        name: 'Grouping by a canonical key',
        description:
          'Items that are "equivalent" can be grouped by mapping each one to a canonical key, e.g. the sorted letters or letter counts of a word to group anagrams. Choosing a key that is cheap to compute and collision-free is the crux.',
      },
      {
        id: 'arrays-hashing.prefix-sums',
        name: 'Prefix sums',
        description:
          'A prefix-sum array stores running totals so any range sum is prefix[r+1] - prefix[l] in O(1). Combined with a hash map of seen prefix sums it counts subarrays that sum to K in O(n).',
      },
      {
        id: 'arrays-hashing.in-place-tricks',
        name: 'In-place index tricks',
        description:
          'When values lie in a known range like 1..n, the array itself can act as a hash table: mark visited values by negating or swapping into their index (cyclic sort). This gives O(1) extra space for "find missing/duplicate number" problems.',
      },
      {
        id: 'arrays-hashing.hashing-pitfalls',
        name: 'Hashing pitfalls',
        description:
          'Hash operations are O(1) on average but O(n) in the worst case with many collisions. Keys must be immutable and have consistent equality and hash functions; mutable keys such as lists must be converted (e.g. to tuples or strings) first.',
      },
    ],
  },
  {
    id: 'two-pointers',
    name: 'Two Pointers',
    description:
      'Moving two indices through a sequence to replace nested loops with a single linear pass.',
    concepts: [
      {
        id: 'two-pointers.opposite-ends',
        name: 'Pointers from opposite ends',
        description:
          'Start one pointer at each end and move them inward based on a comparison. On a sorted array this solves pair-sum problems in O(n): if the sum is too small move the left pointer right, if too large move the right pointer left.',
      },
      {
        id: 'two-pointers.fast-slow',
        name: 'Fast & slow (same direction)',
        description:
          'Two pointers move in the same direction at different speeds or conditions, e.g. a write pointer and a read pointer to compact an array in place, or a fast pointer that runs ahead to find the middle or detect a cycle.',
      },
      {
        id: 'two-pointers.palindromes',
        name: 'Palindrome checks',
        description:
          'Compare characters from both ends moving inward to test a palindrome in O(n) time and O(1) space. Variants skip non-alphanumeric characters or allow deleting one character by trying both skips once.',
      },
      {
        id: 'two-pointers.in-place-removal',
        name: 'In-place removal & partitioning',
        description:
          'A slow write pointer keeps the "kept" prefix while a fast pointer scans. This removes duplicates from a sorted array or partitions elements (e.g. moving zeros to the end, Dutch national flag) in one pass without extra memory.',
      },
      {
        id: 'two-pointers.sorted-pair-sum',
        name: 'Pair & triplet sums on sorted input',
        description:
          'Sorting first (O(n log n)) enables the opposite-ends technique. 3Sum fixes one element and runs two pointers on the rest for O(n^2) total, skipping equal neighbours to avoid duplicate triplets.',
      },
      {
        id: 'two-pointers.merge-sorted',
        name: 'Merging sorted sequences',
        description:
          'One pointer per sorted input, always advancing the smaller element, merges them in O(n + m). Filling from the back avoids overwriting when merging into an array that already has spare space at the end.',
      },
      {
        id: 'two-pointers.container-water',
        name: 'Greedy pointer movement proofs',
        description:
          'In problems like "container with most water" the key insight is which pointer can safely move: moving the taller side can never improve the answer, so always move the shorter side. Justifying why a move discards no optimal answer is the core reasoning skill.',
      },
    ],
  },
  {
    id: 'sliding-window',
    name: 'Sliding Window',
    description:
      'Maintaining a contiguous window over a sequence and updating its state incrementally as it grows and shrinks.',
    concepts: [
      {
        id: 'sliding-window.fixed-size',
        name: 'Fixed-size windows',
        description:
          'For a window of exactly k elements, add the entering element and remove the leaving one each step instead of recomputing, turning O(n·k) into O(n). Used for max-average subarray or matching a pattern of length k.',
      },
      {
        id: 'sliding-window.variable-size',
        name: 'Variable-size windows',
        description:
          'Expand the right edge every step and shrink the left edge while the window violates a constraint. Each index enters and leaves at most once, so the total work is O(n). Used for "longest substring without repeating characters".',
      },
      {
        id: 'sliding-window.window-state',
        name: 'Tracking window state',
        description:
          "The window's contents are summarised in a structure that updates in O(1): a running sum, a frequency map, or a count of how many requirements are currently satisfied. Choosing what to track decides whether the window stays linear.",
      },
      {
        id: 'sliding-window.minimum-window',
        name: 'Shortest window satisfying a condition',
        description:
          'To find the minimum window containing all required items, expand until the window is valid, then shrink from the left as far as possible while staying valid, recording the best length. "Minimum window substring" is the classic.',
      },
      {
        id: 'sliding-window.at-most-k',
        name: '"At most K" counting trick',
        description:
          'Counting subarrays with exactly K distinct values is hard directly, but exactly(K) = atMost(K) - atMost(K-1), and "at most K" is a straightforward variable window that adds (right - left + 1) subarrays per step.',
      },
      {
        id: 'sliding-window.monotonic-deque',
        name: 'Monotonic deque for window max/min',
        description:
          'A deque of indices kept in decreasing value order gives the maximum of every window in O(n) total: pop smaller values from the back before pushing, and pop the front when it slides out of the window.',
      },
      {
        id: 'sliding-window.when-it-applies',
        name: 'When a sliding window applies',
        description:
          "Sliding windows work when the property is monotonic in the window size, e.g. sums of non-negative numbers only grow when expanding. With negative numbers a window can't decide when to shrink, so prefix sums with a hash map are used instead.",
      },
    ],
  },
  {
    id: 'binary-search',
    name: 'Binary Search',
    description:
      'Halving a sorted or monotonic search space each step to find a target or boundary in O(log n).',
    concepts: [
      {
        id: 'binary-search.classic',
        name: 'Classic binary search',
        description:
          'On a sorted array, compare the middle element with the target and discard the half that cannot contain it, giving O(log n). Compute mid as lo + (hi - lo) / 2 to avoid integer overflow in fixed-width languages.',
      },
      {
        id: 'binary-search.boundaries',
        name: 'Lower & upper bound',
        description:
          'Finding the first index where a condition becomes true (lower bound) or the first index greater than the target (upper bound) handles duplicates, insertion positions and counting occurrences as upperBound - lowerBound.',
      },
      {
        id: 'binary-search.loop-invariants',
        name: 'Loop invariants & off-by-one',
        description:
          'Correct binary search depends on a clear invariant: whether the range is [lo, hi] or [lo, hi), whether the loop runs while lo < hi or lo <= hi, and whether lo = mid + 1 or hi = mid. Mixing conventions causes infinite loops or skipped answers.',
      },
      {
        id: 'binary-search.rotated-array',
        name: 'Rotated sorted arrays',
        description:
          'In a rotated sorted array at least one half around mid is always sorted. Check which half is sorted and whether the target lies within its range to decide which side to keep, still O(log n). Duplicates can degrade it to O(n).',
      },
      {
        id: 'binary-search.on-answer',
        name: 'Binary search on the answer',
        description:
          'When the answer is a number and feasibility is monotonic (if speed s works, any faster speed works), binary search over the answer range and test feasibility with a greedy check. Examples: Koko eating bananas, shipping capacity within D days.',
      },
      {
        id: 'binary-search.peak-finding',
        name: 'Searching unsorted monotonic structure',
        description:
          'Binary search only needs a rule that discards half the space. To find a peak element, move toward the larger neighbour: a peak must exist on that side. The same idea finds the minimum in a rotated array.',
      },
      {
        id: 'binary-search.2d-matrix',
        name: 'Searching a 2D matrix',
        description:
          'A matrix whose rows are sorted and each row starts after the previous ends can be treated as one flattened sorted array (index → row = i / cols, col = i % cols). A matrix sorted by rows and columns is instead searched from the top-right corner in O(m + n).',
      },
    ],
  },
  {
    id: 'stack-queue',
    name: 'Stacks & Queues',
    description:
      'LIFO and FIFO structures for matching, deferred work, monotonic sequences and level-by-level processing.',
    concepts: [
      {
        id: 'stack-queue.lifo-fifo',
        name: 'LIFO vs FIFO semantics',
        description:
          'A stack returns the most recently added item (last in, first out); a queue returns the oldest (first in, first out). Both support O(1) push and pop. Picking the right one decides whether you process the newest or the oldest pending work first.',
      },
      {
        id: 'stack-queue.bracket-matching',
        name: 'Matching brackets',
        description:
          'Push opening brackets and, on a closing bracket, check that the top of the stack is its matching opener. The string is valid if every close matches and the stack ends empty. The same pattern handles nested structures like tags.',
      },
      {
        id: 'stack-queue.monotonic-stack',
        name: 'Monotonic stack',
        description:
          'A stack kept in increasing or decreasing order finds the next greater or smaller element for every index in O(n): pop while the current value beats the top, and each popped index has found its answer. Used for daily temperatures and largest rectangle in a histogram.',
      },
      {
        id: 'stack-queue.expression-evaluation',
        name: 'Expression evaluation',
        description:
          'Postfix (Reverse Polish) expressions evaluate with one operand stack. Infix expressions need operator precedence, handled with two stacks (shunting-yard) or a running result with a sign stack for parentheses.',
      },
      {
        id: 'stack-queue.min-stack',
        name: 'Stacks with extra queries',
        description:
          'A min-stack answers getMin in O(1) by storing, alongside each value, the minimum at that depth (or keeping a second stack of minimums). The idea generalises: cache an aggregate per stack level so pops restore it for free.',
      },
      {
        id: 'stack-queue.queue-via-stacks',
        name: 'Queue from two stacks',
        description:
          'Push onto an input stack; when popping, if the output stack is empty, move everything over, which reverses the order. Each element moves at most once, so operations are amortised O(1).',
      },
      {
        id: 'stack-queue.deque-circular',
        name: 'Deques & circular buffers',
        description:
          'A deque supports O(1) insertion and removal at both ends. A circular buffer implements a fixed-capacity queue in an array with head and tail indices that wrap around using modulo, avoiding O(n) shifting.',
      },
      {
        id: 'stack-queue.recursion-to-stack',
        name: 'Recursion as an explicit stack',
        description:
          'Every recursive algorithm uses the call stack; it can be rewritten iteratively with an explicit stack to avoid stack-overflow on deep inputs, e.g. iterative DFS or iterative in-order traversal.',
      },
    ],
  },
  {
    id: 'linked-list',
    name: 'Linked Lists',
    description:
      'Node-and-pointer sequences: rewiring links in place, detecting cycles and merging lists.',
    concepts: [
      {
        id: 'linked-list.traversal-complexity',
        name: 'Linked list trade-offs',
        description:
          'Linked lists give O(1) insertion or deletion once you hold the neighbouring node, but O(n) access by index and poor cache locality. Doubly linked lists also allow O(1) removal of a known node.',
      },
      {
        id: 'linked-list.reversal',
        name: 'Reversing a list',
        description:
          'Iteratively walk the list with prev, curr and next pointers, pointing each node back at prev: O(n) time, O(1) space. Reversing a sub-range or k-groups reuses the same step while reconnecting the boundary nodes.',
      },
      {
        id: 'linked-list.dummy-head',
        name: 'Dummy (sentinel) head',
        description:
          'A dummy node placed before the real head removes special cases when the head itself may be deleted or replaced, e.g. removing elements or merging lists. Return dummy.next at the end.',
      },
      {
        id: 'linked-list.cycle-detection',
        name: 'Cycle detection (Floyd)',
        description:
          "A slow pointer moves one step and a fast pointer two; they meet if and only if there is a cycle. Resetting one pointer to the head and moving both one step at a time makes them meet at the cycle's entry node.",
      },
      {
        id: 'linked-list.middle-and-kth',
        name: 'Middle & k-th from end',
        description:
          'Fast/slow pointers find the middle in one pass. To find the k-th node from the end, advance a lead pointer k steps, then move both until the lead reaches the end.',
      },
      {
        id: 'linked-list.merge-lists',
        name: 'Merging sorted lists',
        description:
          'Merge two sorted lists by repeatedly attaching the smaller head to a tail pointer, O(n + m). Merging k lists uses a min-heap of heads in O(N log k) or pairwise divide-and-conquer.',
      },
      {
        id: 'linked-list.lru-cache',
        name: 'Hash map + doubly linked list (LRU)',
        description:
          'An LRU cache pairs a hash map (key → node) with a doubly linked list ordered by recency. Both get and put are O(1): move accessed nodes to the front and evict from the tail when over capacity.',
      },
    ],
  },
  {
    id: 'trees',
    name: 'Binary Trees',
    description:
      'Recursive structure of nodes with left and right children: traversals, depth, paths and construction.',
    concepts: [
      {
        id: 'trees.dfs-traversals',
        name: 'Pre-, in- and post-order DFS',
        description:
          "Depth-first traversals differ by when the node is visited relative to its children: pre-order (node, left, right) for copying, in-order (left, node, right) for sorted output of a BST, post-order (left, right, node) when the answer depends on the children's results.",
      },
      {
        id: 'trees.bfs-level-order',
        name: 'Level-order traversal (BFS)',
        description:
          'A queue visits nodes level by level. Processing the queue in batches of its current size separates levels, which solves right-side view, level averages and zig-zag traversal.',
      },
      {
        id: 'trees.height-depth',
        name: 'Height, depth & balance',
        description:
          "Height is computed bottom-up as 1 + max(left, right). A tree is height-balanced if every node's subtrees differ in height by at most one; checking this in O(n) means returning the height and the balance status from the same recursion.",
      },
      {
        id: 'trees.recursion-return-values',
        name: 'Combining subtree results',
        description:
          'Many tree problems return a value from each subtree and combine them, while tracking a global best separately. In "diameter" or "maximum path sum" a node returns its best single downward path but updates the answer with the path through both children.',
      },
      {
        id: 'trees.lowest-common-ancestor',
        name: 'Lowest common ancestor',
        description:
          'In a binary tree, recursively search both sides: if p and q are found in different subtrees the current node is the LCA, otherwise pass up whichever side found something. O(n) time.',
      },
      {
        id: 'trees.construction',
        name: 'Building trees from traversals',
        description:
          'Pre-order gives the root first and in-order splits left and right subtrees around it, so the two together rebuild a unique tree. A hash map of in-order indices makes the construction O(n).',
      },
      {
        id: 'trees.serialization',
        name: 'Serialising a tree',
        description:
          'Writing a tree as a pre-order or level-order sequence with explicit null markers makes it reconstructable. Without null markers, a single traversal is ambiguous.',
      },
      {
        id: 'trees.complexity',
        name: 'Recursion depth & complexity',
        description:
          'Visiting every node is O(n) time; recursion uses O(h) stack space, where h is O(log n) for balanced trees but O(n) for skewed ones. Deep skewed trees can overflow the call stack, so an iterative approach is safer.',
      },
    ],
  },
  {
    id: 'bst',
    name: 'Binary Search Trees',
    description:
      'Ordered binary trees where left < node < right, enabling search, insertion and range queries in O(h).',
    concepts: [
      {
        id: 'bst.property',
        name: 'The BST property',
        description:
          "Every value in a node's left subtree is smaller and every value in its right subtree is larger. It must hold for the whole subtree, not just the direct children, which is the usual mistake when validating a BST.",
      },
      {
        id: 'bst.validation',
        name: 'Validating a BST',
        description:
          'Pass down an allowed (low, high) range: going left tightens the upper bound, going right tightens the lower bound. Alternatively an in-order traversal must produce a strictly increasing sequence.',
      },
      {
        id: 'bst.search-insert',
        name: 'Search & insert',
        description:
          'Search and insertion walk one root-to-leaf path, choosing left or right by comparison, so they cost O(h): O(log n) when balanced and O(n) when the tree degenerates into a list (e.g. inserting sorted data).',
      },
      {
        id: 'bst.deletion',
        name: 'Deleting a node',
        description:
          'A leaf is removed directly; a node with one child is replaced by that child; a node with two children is replaced by its in-order successor (smallest in the right subtree) or predecessor, which is then deleted from its subtree.',
      },
      {
        id: 'bst.inorder-sorted',
        name: 'In-order gives sorted order',
        description:
          'In-order traversal of a BST visits values in ascending order. This finds the k-th smallest element (stop after k visits), builds an iterator with an explicit stack, or converts the tree to a sorted list.',
      },
      {
        id: 'bst.successor-predecessor',
        name: 'Successor, predecessor & floor/ceiling',
        description:
          'The in-order successor is the leftmost node of the right subtree, or else the nearest ancestor reached from a left child. Floor and ceiling queries walk down once, remembering the best candidate seen.',
      },
      {
        id: 'bst.balancing',
        name: 'Balanced BSTs',
        description:
          'Self-balancing trees (AVL, red-black) use rotations to keep height O(log n), guaranteeing logarithmic operations. Library ordered maps (TreeMap, std::map) are built on them. A sorted array converts to a balanced BST by choosing the middle as root recursively.',
      },
    ],
  },
  {
    id: 'heaps',
    name: 'Heaps & Priority Queues',
    description:
      'Partially ordered trees that give O(1) access to the min or max and O(log n) insert and removal.',
    concepts: [
      {
        id: 'heaps.heap-property',
        name: 'Heap property & array layout',
        description:
          'A binary heap is a complete binary tree where each parent is ≤ its children (min-heap). Stored in an array, the children of index i are 2i+1 and 2i+2 and the parent is (i-1)/2, so no pointers are needed.',
      },
      {
        id: 'heaps.operations',
        name: 'Push, pop & heapify',
        description:
          'Push appends and sifts up, pop swaps the root with the last element and sifts down, both O(log n). Building a heap from n items by sifting down from the last parent is O(n), faster than n separate pushes.',
      },
      {
        id: 'heaps.top-k',
        name: 'Top-K with a bounded heap',
        description:
          'To keep the K largest items, maintain a min-heap of size K and pop whenever it grows past K; the root is the K-th largest. This is O(n log K), better than sorting when K is small.',
      },
      {
        id: 'heaps.two-heaps-median',
        name: 'Two heaps for a running median',
        description:
          'A max-heap holds the smaller half and a min-heap the larger half, rebalanced so their sizes differ by at most one. The median is read from the roots in O(1) and each insert is O(log n).',
      },
      {
        id: 'heaps.k-way-merge',
        name: 'K-way merge',
        description:
          "Merging k sorted lists pushes each list's head into a min-heap, then repeatedly pops the smallest and pushes its successor. Total O(N log k) for N elements.",
      },
      {
        id: 'heaps.scheduling',
        name: 'Greedy scheduling with heaps',
        description:
          'Heaps pick the best next option as the state changes: the meeting room that frees earliest, the task with the highest remaining count, or the cheapest next edge. They power greedy algorithms such as Dijkstra and Prim.',
      },
      {
        id: 'heaps.custom-comparators',
        name: 'Max-heaps & custom priorities',
        description:
          'Many libraries only provide a min-heap; a max-heap is simulated by negating keys. Tuples or comparators order by several criteria, e.g. (distance, index), and stale entries can be lazily skipped when popped instead of deleted.',
      },
    ],
  },
  {
    id: 'graphs',
    name: 'Graphs',
    description:
      'Vertices and edges: representations, traversals, shortest paths, topological ordering and connectivity.',
    concepts: [
      {
        id: 'graphs.representation',
        name: 'Adjacency list vs matrix',
        description:
          'An adjacency list uses O(V + E) space and is ideal for sparse graphs; an adjacency matrix uses O(V²) but answers "is there an edge u→v?" in O(1). Grids are implicit graphs whose neighbours are the adjacent cells.',
      },
      {
        id: 'graphs.bfs',
        name: 'Breadth-first search',
        description:
          'BFS explores in rings of increasing distance using a queue, so in an unweighted graph the first time it reaches a node is via a shortest path. Mark nodes visited when enqueued, not when dequeued, to avoid duplicates. O(V + E).',
      },
      {
        id: 'graphs.dfs',
        name: 'Depth-first search',
        description:
          'DFS follows one path as deep as possible before backtracking, recursively or with a stack. It counts connected components, flood-fills grids (number of islands) and detects cycles. O(V + E) with a visited set.',
      },
      {
        id: 'graphs.topological-sort',
        name: 'Topological sort',
        description:
          "A topological order lists a DAG's nodes so every edge points forward. Kahn's algorithm repeatedly removes nodes with in-degree 0; if some nodes are never removed, the graph has a cycle (e.g. course schedule is impossible).",
      },
      {
        id: 'graphs.cycle-detection',
        name: 'Cycle detection',
        description:
          'In a directed graph DFS uses three colours (unvisited, in progress, done); reaching an in-progress node means a cycle. In an undirected graph a cycle exists if DFS reaches a visited node other than the parent, or union-find joins two already-connected nodes.',
      },
      {
        id: 'graphs.dijkstra',
        name: "Dijkstra's shortest paths",
        description:
          'For non-negative weights, repeatedly settle the unvisited node with the smallest tentative distance using a min-heap and relax its edges. O((V + E) log V). It fails with negative edges, where Bellman-Ford is needed.',
      },
      {
        id: 'graphs.multi-source-bfs',
        name: 'Multi-source BFS',
        description:
          "Starting BFS from all sources at once (all rotten oranges, all gates) computes each cell's distance to its nearest source in a single O(V + E) pass instead of one BFS per source.",
      },
      {
        id: 'graphs.mst',
        name: 'Minimum spanning tree',
        description:
          'An MST connects all vertices with minimum total weight. Kruskal sorts edges and adds each one that joins two different components (with union-find); Prim grows one tree using a min-heap of crossing edges.',
      },
      {
        id: 'graphs.bipartite',
        name: 'Bipartite check (2-colouring)',
        description:
          'A graph is bipartite if nodes can be coloured with two colours so every edge joins different colours. BFS or DFS assigns alternating colours and fails on an edge between same-coloured nodes, i.e. an odd cycle.',
      },
    ],
  },
  {
    id: 'dynamic-programming',
    name: 'Dynamic Programming',
    description:
      'Solving problems with overlapping subproblems and optimal substructure by storing sub-results.',
    concepts: [
      {
        id: 'dynamic-programming.overlapping-subproblems',
        name: 'Overlapping subproblems & optimal substructure',
        description:
          'DP applies when the optimal answer is built from optimal answers to smaller subproblems, and those subproblems repeat. Naive recursion on Fibonacci is exponential because it recomputes the same values; caching makes it linear.',
      },
      {
        id: 'dynamic-programming.memoization',
        name: 'Top-down memoisation',
        description:
          'Write the natural recursion, then cache results keyed by the state parameters. It only computes states that are actually reached, but recursion depth can be a limit.',
      },
      {
        id: 'dynamic-programming.tabulation',
        name: 'Bottom-up tabulation',
        description:
          "Fill a table in an order where each entry's dependencies are already computed. It avoids recursion overhead and makes space optimisation visible, e.g. keeping only the previous row or the last two values.",
      },
      {
        id: 'dynamic-programming.state-definition',
        name: 'Defining state & transitions',
        description:
          'The hardest step is choosing what dp[i] (or dp[i][j]) means, e.g. "the best answer using the first i items" or "ending exactly at i", and writing the recurrence and base cases. Complexity is the number of states times the work per transition.',
      },
      {
        id: 'dynamic-programming.1d-linear',
        name: '1D linear DP',
        description:
          'Problems like climbing stairs, house robber and decode ways define dp[i] from a few previous entries, e.g. dp[i] = max(dp[i-1], dp[i-2] + nums[i]). They usually reduce to O(1) space.',
      },
      {
        id: 'dynamic-programming.knapsack',
        name: 'Knapsack & subset sums',
        description:
          "0/1 knapsack chooses each item at most once: dp[w] over capacities, iterating capacity downward so items aren't reused. Unbounded knapsack (coin change) iterates upward. Subset-sum and partition problems are knapsack in disguise.",
      },
      {
        id: 'dynamic-programming.grid-paths',
        name: 'Grid DP',
        description:
          'For paths in a grid moving only right or down, dp[r][c] combines dp[r-1][c] and dp[r][c-1], e.g. counting unique paths or minimum path sum. Obstacles set their cell to 0 or infinity.',
      },
      {
        id: 'dynamic-programming.two-sequence',
        name: 'Two-sequence DP (LCS, edit distance)',
        description:
          'dp[i][j] describes prefixes of two strings. Longest common subsequence extends on a match and otherwise takes the max of skipping either character; edit distance takes 1 + the min of insert, delete and replace. O(n·m).',
      },
      {
        id: 'dynamic-programming.lis',
        name: 'Longest increasing subsequence',
        description:
          'The O(n²) DP sets dp[i] = 1 + max dp[j] for j < i with nums[j] < nums[i]. The O(n log n) version keeps the smallest tail of each length in an array and binary-searches where each number goes.',
      },
    ],
  },
  {
    id: 'greedy',
    name: 'Greedy Algorithms',
    description:
      'Making the locally best choice at each step, and proving that it never rules out an optimal solution.',
    concepts: [
      {
        id: 'greedy.greedy-choice',
        name: 'Greedy choice property',
        description:
          'A greedy algorithm commits to the best-looking option now and never revisits it. It is only correct when a locally optimal choice can always be extended to a global optimum, which must be argued rather than assumed.',
      },
      {
        id: 'greedy.exchange-argument',
        name: 'Proving greedy correct (exchange argument)',
        description:
          'An exchange argument shows that any optimal solution can be transformed, step by step, into the greedy one without getting worse. "Greedy stays ahead" shows that greedy is at least as good as any other solution after every step.',
      },
      {
        id: 'greedy.when-greedy-fails',
        name: 'When greedy fails',
        description:
          'Greedy breaks when an early choice blocks better later options, e.g. coin change with denominations {1, 3, 4} for amount 6 (greedy picks 4+1+1, optimal is 3+3), or 0/1 knapsack by value density. Those need DP.',
      },
      {
        id: 'greedy.interval-scheduling',
        name: 'Interval scheduling',
        description:
          'To fit the most non-overlapping intervals, sort by end time and always take the interval that finishes first, which leaves the most room for the rest. Sorting by start time or by length does not work.',
      },
      {
        id: 'greedy.jump-game',
        name: 'Reachability (jump game)',
        description:
          'Track the farthest index reachable so far while scanning; if the current index ever exceeds it, the end is unreachable. The minimum-jumps variant counts how many times the current "level" boundary must be extended, like BFS by ranges.',
      },
      {
        id: 'greedy.sorting-first',
        name: 'Sort, then decide',
        description:
          'Many greedy solutions start by sorting so the best candidate is always next: assigning cookies to children, boats with two people, or the largest number by custom string ordering (compare a+b with b+a).',
      },
      {
        id: 'greedy.running-balance',
        name: 'Running balance (gas station, Kadane)',
        description:
          "Keep a running total and reset the starting point whenever it goes negative. In the gas station problem, if total gas ≥ total cost a solution exists and starts right after the last reset; Kadane's maximum subarray uses the same idea.",
      },
    ],
  },
  {
    id: 'backtracking',
    name: 'Backtracking',
    description:
      'Exploring a decision tree by choosing, recursing and undoing choices, while pruning branches that cannot succeed.',
    concepts: [
      {
        id: 'backtracking.choose-explore-unchoose',
        name: 'Choose, explore, un-choose',
        description:
          'Backtracking builds a candidate incrementally: make a choice, recurse, then undo it so the shared state is clean for the next choice. Forgetting to undo (or to copy the path when recording a result) is the classic bug.',
      },
      {
        id: 'backtracking.subsets',
        name: 'Subsets',
        description:
          'Each element is either included or excluded, giving 2^n subsets. Alternatively loop from a start index and add each later element, recording the path at every node. Sorting and skipping equal neighbours removes duplicate subsets.',
      },
      {
        id: 'backtracking.permutations',
        name: 'Permutations',
        description:
          'Choose any unused element for each position, tracking usage with a boolean array or by swapping in place, producing n! orderings. With duplicates, sort and skip an element if it equals the previous unused one.',
      },
      {
        id: 'backtracking.combinations',
        name: 'Combinations & combination sum',
        description:
          "Choosing k elements, or elements that sum to a target, iterates from a start index so the same set isn't produced in a different order. Reusing an element means recursing with the same index; otherwise index + 1.",
      },
      {
        id: 'backtracking.pruning',
        name: 'Pruning',
        description:
          'Stop exploring a branch as soon as it cannot lead to a valid answer, e.g. the remaining sum is negative, or the partial string already violates the rules. Sorting candidates often lets you break out of the loop entirely.',
      },
      {
        id: 'backtracking.constraint-satisfaction',
        name: 'Constraint problems (N-Queens, Sudoku)',
        description:
          'Place one item at a time and check constraints incrementally with O(1) lookups: sets of used columns and diagonals (r - c and r + c) for N-Queens, or row/column/box sets for Sudoku.',
      },
      {
        id: 'backtracking.grid-search',
        name: 'Path search in a grid',
        description:
          'Word search explores from each cell in four directions, marking cells as visited during the current path and unmarking on return. Worst case is exponential in the word length, so pruning on mismatched characters matters.',
      },
      {
        id: 'backtracking.complexity',
        name: 'Complexity of backtracking',
        description:
          'Running time is roughly the number of nodes in the decision tree times the work per node, e.g. O(n · 2^n) for subsets and O(n · n!) for permutations. Pruning improves the practical runtime but rarely the worst-case bound.',
      },
    ],
  },
  {
    id: 'tries',
    name: 'Tries',
    description:
      'Prefix trees that store strings character by character for fast prefix search and autocomplete.',
    concepts: [
      {
        id: 'tries.structure',
        name: 'Trie structure',
        description:
          'Each node holds children keyed by character (a map, or an array of 26 for lowercase letters) and an end-of-word flag. A path from the root spells a prefix, and shared prefixes share nodes.',
      },
      {
        id: 'tries.insert-search',
        name: 'Insert, search & startsWith',
        description:
          'Insert walks or creates one node per character and marks the last node as the end of a word. Search requires the end flag; startsWith only needs the path to exist. Each operation is O(L) for a word of length L, independent of how many words are stored.',
      },
      {
        id: 'tries.vs-hash-set',
        name: 'Trie vs hash set',
        description:
          'A hash set answers exact-word lookups just as fast, but cannot answer "which words start with this prefix" without scanning everything. Tries win for prefix queries and autocomplete; hash sets are simpler and use less memory for exact lookups.',
      },
      {
        id: 'tries.wildcard-search',
        name: 'Wildcard search',
        description:
          'Supporting "." as any letter turns search into a DFS: at a wildcard, try every child. The cost grows with the number of wildcards, but the shared prefix structure still prunes heavily.',
      },
      {
        id: 'tries.word-search-ii',
        name: 'Trie-guided grid search',
        description:
          'To find many words in a grid, insert them all into a trie and run one DFS per cell that walks the trie alongside the grid, stopping as soon as the current path is not a prefix. Removing found words from the trie avoids repeats.',
      },
      {
        id: 'tries.autocomplete',
        name: 'Autocomplete & prefix counts',
        description:
          'Storing a counter of words passing through each node answers "how many words share this prefix" in O(L). Keeping the top suggestions at each node trades memory for instant autocomplete.',
      },
      {
        id: 'tries.memory',
        name: 'Memory trade-offs',
        description:
          'Array-based children are fast but waste space for sparse alphabets; map-based children save memory but are slower. Compressed tries (radix trees) merge single-child chains into one edge labelled with a substring.',
      },
    ],
  },
  {
    id: 'intervals',
    name: 'Intervals',
    description:
      'Reasoning about ranges [start, end]: sorting, merging, inserting and counting overlaps.',
    concepts: [
      {
        id: 'intervals.overlap-test',
        name: 'Testing overlap',
        description:
          "Two intervals [a, b] and [c, d] overlap if a ≤ d and c ≤ b (strict inequalities if touching endpoints don't count). Equivalently they do NOT overlap when one ends before the other starts.",
      },
      {
        id: 'intervals.merge',
        name: 'Merging intervals',
        description:
          'Sort by start, then scan: if the next interval starts before the current one ends, extend the current end to the max of both ends; otherwise start a new merged interval. O(n log n) for the sort.',
      },
      {
        id: 'intervals.insert',
        name: 'Inserting into sorted intervals',
        description:
          'With intervals already sorted and disjoint, add all that end before the new one starts, merge all that overlap it into one, then add the rest: a single O(n) pass without re-sorting.',
      },
      {
        id: 'intervals.meeting-rooms',
        name: 'Minimum rooms (max overlap)',
        description:
          'The number of rooms needed is the maximum number of intervals active at once. Sort start and end times separately and sweep, or keep a min-heap of end times and reuse a room when the earliest end is ≤ the next start.',
      },
      {
        id: 'intervals.sweep-line',
        name: 'Sweep line',
        description:
          'Turn intervals into +1 events at starts and -1 events at ends, sort the events (decide the tie order deliberately), and keep a running count. This finds maximum overlap, busy periods or free time across many schedules.',
      },
      {
        id: 'intervals.remove-min',
        name: 'Removing the fewest intervals',
        description:
          'The minimum number of removals to make intervals non-overlapping equals n minus the maximum number of non-overlapping intervals, found greedily by sorting by end time and keeping each interval that starts after the last kept end.',
      },
      {
        id: 'intervals.intersection',
        name: 'Intersecting interval lists',
        description:
          'For two sorted lists, use one pointer each: the overlap of the current pair is [max(starts), min(ends)] if non-empty, then advance the pointer whose interval ends first. O(n + m).',
      },
    ],
  },
  {
    id: 'bit-manipulation',
    name: 'Bit Manipulation',
    description:
      'Using binary representations and bitwise operators for compact state, fast arithmetic tricks and XOR identities.',
    concepts: [
      {
        id: 'bit-manipulation.operators',
        name: 'Bitwise operators',
        description:
          'AND (&) keeps bits set in both, OR (|) in either, XOR (^) in exactly one, NOT (~) flips all bits, and shifts move bits left (×2) or right (÷2). Right shifts on negative numbers differ between arithmetic and logical shifts.',
      },
      {
        id: 'bit-manipulation.set-clear-test',
        name: 'Setting, clearing & testing bits',
        description:
          'Test bit i with (x >> i) & 1, set it with x | (1 << i), clear it with x & ~(1 << i), and toggle it with x ^ (1 << i). These are the building blocks for using an integer as a set of flags.',
      },
      {
        id: 'bit-manipulation.xor-tricks',
        name: 'XOR properties',
        description:
          'x ^ x = 0 and x ^ 0 = x, and XOR is commutative and associative. XOR-ing all numbers cancels pairs, so it finds the single non-duplicated number, or the missing number when XOR-ed against 0..n.',
      },
      {
        id: 'bit-manipulation.lowest-set-bit',
        name: 'Lowest set bit tricks',
        description:
          'x & (x - 1) clears the lowest set bit, so counting how many times it runs until zero counts the set bits (Kernighan). x & -x isolates the lowest set bit. x > 0 and x & (x - 1) == 0 tests for a power of two.',
      },
      {
        id: 'bit-manipulation.bitmask-subsets',
        name: 'Bitmasks as subsets',
        description:
          'An n-bit integer represents a subset of n items, so looping masks from 0 to 2^n - 1 enumerates all subsets. Bitmask DP (e.g. travelling salesman) uses the mask as part of the DP state.',
      },
      {
        id: 'bit-manipulation.twos-complement',
        name: "Two's complement & overflow",
        description:
          "Negative integers are stored in two's complement: -x equals ~x + 1, and the top bit is the sign. Fixed-width integers overflow and wrap, which matters when adding without +, reversing bits or emulating 32-bit behaviour in Python or JavaScript.",
      },
      {
        id: 'bit-manipulation.counting-bits',
        name: 'Counting bits for a range',
        description:
          'The number of set bits for every number 0..n follows dp[i] = dp[i >> 1] + (i & 1), or dp[i] = dp[i & (i - 1)] + 1, computing the whole table in O(n).',
      },
    ],
  },
  {
    id: 'sorting',
    name: 'Sorting',
    description:
      'Comparison and non-comparison sorts, their trade-offs, and sorting as a preprocessing step.',
    concepts: [
      {
        id: 'sorting.comparison-lower-bound',
        name: 'Comparison sort lower bound',
        description:
          'Any comparison-based sort needs Ω(n log n) comparisons in the worst case, because it must distinguish n! possible orderings. Only non-comparison sorts that exploit key structure can beat it.',
      },
      {
        id: 'sorting.merge-sort',
        name: 'Merge sort',
        description:
          'Split in half, sort each half recursively, then merge: O(n log n) in every case and stable, but needs O(n) extra space for arrays. The merge step also counts inversions and is used for external sorting.',
      },
      {
        id: 'sorting.quick-sort',
        name: 'Quick sort & partitioning',
        description:
          'Partition around a pivot so smaller elements go left and larger go right, then recurse. Average O(n log n) in place, but O(n²) when pivots are consistently bad (e.g. already sorted input with a first-element pivot); random pivots avoid this.',
      },
      {
        id: 'sorting.quickselect',
        name: 'Quickselect (k-th element)',
        description:
          'Partition like quick sort but recurse only into the side containing the k-th position, giving average O(n) to find the k-th smallest element without fully sorting. The worst case is still O(n²).',
      },
      {
        id: 'sorting.stability',
        name: 'Stability',
        description:
          'A stable sort keeps equal elements in their original relative order. It matters when sorting by several keys in passes (sort by secondary key, then stably by primary). Merge sort and insertion sort are stable; quick sort and heap sort usually are not.',
      },
      {
        id: 'sorting.counting-radix',
        name: 'Counting & radix sort',
        description:
          'When keys are small integers, counting sort tallies each value and rebuilds the output in O(n + k). Radix sort applies a stable counting sort digit by digit, O(d · (n + b)). Bucket sort spreads uniformly distributed values into buckets.',
      },
      {
        id: 'sorting.simple-sorts',
        name: 'Insertion, selection & bubble sort',
        description:
          'These O(n²) sorts are simple and in place. Insertion sort is O(n) on nearly sorted input and is used inside hybrid sorts (Timsort, introsort) for small partitions.',
      },
      {
        id: 'sorting.custom-comparators',
        name: 'Custom comparators',
        description:
          'Sorting by a key or comparator solves ordering problems: intervals by start, strings by concatenation order, or points by distance. A comparator must be consistent (a transitive total order), or the sort can misbehave.',
      },
    ],
  },
  {
    id: 'union-find',
    name: 'Union-Find (Disjoint Set)',
    description:
      'Tracking which elements belong to the same group under merges, in near-constant time per operation.',
    concepts: [
      {
        id: 'union-find.structure',
        name: 'Parent array representation',
        description:
          'Each element points to a parent, and each group is a tree whose root is its representative. find(x) follows parents to the root; union(a, b) links one root under the other.',
      },
      {
        id: 'union-find.path-compression',
        name: 'Path compression',
        description:
          'During find, point every visited node directly at the root (or at its grandparent with path halving). This flattens the trees so later finds are almost O(1).',
      },
      {
        id: 'union-find.union-by-rank',
        name: 'Union by rank or size',
        description:
          'Attach the shorter (or smaller) tree under the taller one so trees stay shallow. Together with path compression, operations run in amortised O(α(n)), the inverse Ackermann function, which is effectively constant.',
      },
      {
        id: 'union-find.connected-components',
        name: 'Counting connected components',
        description:
          'Start with n components and decrement each time a union merges two different roots. This counts components or provinces as edges arrive, without building an adjacency list or running DFS.',
      },
      {
        id: 'union-find.cycle-detection',
        name: 'Detecting cycles & redundant edges',
        description:
          'In an undirected graph, an edge whose endpoints already share a root closes a cycle. This finds the redundant connection and checks whether edges form a valid tree (exactly n - 1 edges and no cycle).',
      },
      {
        id: 'union-find.kruskal',
        name: "Kruskal's MST",
        description:
          'Sort edges by weight and add each edge that joins two different components, using union-find to check and merge. The result is a minimum spanning tree in O(E log E).',
      },
      {
        id: 'union-find.vs-dfs',
        name: 'Union-find vs DFS/BFS',
        description:
          'Union-find shines for dynamic connectivity, where edges arrive over time and you query connectivity in between, and for grouping by equivalence (accounts merge). It does not support splitting groups or finding paths; use DFS/BFS for those.',
      },
    ],
  },
];

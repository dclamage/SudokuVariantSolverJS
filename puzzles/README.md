# puzzles.json

puzzles.json contains puzzles that are used to test changes to brute force. This file should contain basically all puzzles and attempt to vary the puzzle types. Some puzzles are left out because the solver is currently unable to solve them quickly or because they come from a puzzle set which has a specific "kind" of puzzle. In such cases, only a few puzzles from the set should be included in puzzles.json and the rest of the puzzles in the set should be split into their own file. This prevents large puzzle sets from biasing the benchmarks in favour of that type of puzzle.

# puzzles-ci.json

puzzles-ci.json contains puzzles that are used for `npm test`. This file contains the fastest puzzles we can solve, with at least one puzzle per puzzle type. It was generated with the following command:

```sh
# First get stats for all the puzzles
npx tsx tests/TestPuzzles.ts --printStats --timeout 20000 < puzzles/puzzles.json > stats.json
# Breakdown:
# - save input in a variable named $input
# - get list of all categories and store in a list named $categories
# - using reduce, loop over each category, and pick the fastest puzzle in that category. this builds up a list of puzzles
# - deduplicate puzzles
jq '. as $input | (map(.generatedCategories[]) | sort | unique) as $categories | reduce $categories[] as $category ([];. + [$input | sort_by(.solveElapsedTimeMs) | map(select(.generatedCategories | contains([$category])))[0]]) | sort_by(.title) | unique_by(.title)' stats.json > puzzles/puzzles-ci.json
# Regenerate the json so the stats are removed
npx tsx tests/TestPuzzles.ts --printAll < puzzles/puzzles-ci.json > puzzles/puzzles-ci2.json; mv puzzles/puzzles-ci2.json puzzles/puzzles-ci.json
```

We pick the fastest puzzles here since in CI we are more concerned about code coverage, not benchmarking.

# puzzles-timeout.json

These are puzzles we would want to include in puzzles.json, but are currently too hard for the solver at the moment. As solver improvements are made, puzzles in this file should be moved to puzzles.json as they become solvable.

# lubaf-coloring-book.json

These are puzzles from Lubaf's coloring book set, published in the CtC discord puzzle archive.

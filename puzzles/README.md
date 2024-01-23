# puzzles.json

puzzles.json contains puzzles that are used to test changes to brute force. This file should contain basically all puzzles and attempt to vary the puzzle types. Some puzzles are left out because the solver is currently unable to solve them quickly or because they come from a puzzle set which has a specific "kind" of puzzle. In such cases, only a few puzzles from the set should be included in puzzles.json and the rest of the puzzles in the set should be split into their own file. This prevents large puzzle sets from biasing the benchmarks in favour of that type of puzzle.

## categories vs generatedCategories

`categories` is what you want to edit when adding a new puzzle. Passing puzzles.json through the `--printAll` of the testing script extracts categories from the puzzle format, combines it with `categories`, and then stores them in the key `generatedCategories`.

When querying for puzzles in the puzzles.json files, `generatedCategories` is what you want to use, as it would include categories such as `thermometer` that were extracted from the puzzle format.

Here's one way you can regenerate generated categories:

```sh
npx tsx tests/TestPuzzles.ts --printAll < puzzles/puzzles.json > puzzles/puzzles2.json &&
  mv puzzles/puzzles2.json puzzles/puzzles.json
```

## "Bug coverage" categories for regression testing

These are added to puzzles when they've detected a bug in a past version of the solver. Adding these categories ensures that they will always be included in puzzles-ci.json to make sure we don't re-introduce the same bug.

Example:

```json
    {
        "title": "Third-Degree Murder",
        "author": "jeremydover & Raumplaner",
        "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        "puzzle": "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",
        "solution": "391726548742958361856314792638472159475189236129563874583691427914237685267845913",
        "categories": [
            "bugcoverage1"
        ],
        "comments": "",
        "puzzleSolution": "391726548742958361856314792638472159475189236129563874583691427914237685267845913",
        "generatedCategories": [
            "bugcoverage1",
            "entropicline",
            "gridsize9x9",
            "killercage"
        ]
    },
```

# puzzles-ci.json

puzzles-ci.json contains puzzles that are used for `npm test`. This file contains the fastest puzzles we can solve, with at least one puzzle per puzzle type. It was generated with the following command:

```sh
# First get stats for all the puzzles
npx tsx tests/TestPuzzles.ts --printStats --timeout 20000 < puzzles/puzzles.json > stats.json
# Breakdown:
# - sort input by increasing runtime and increasing # of categories
# - greedily pick the first puzzle which has a previously unseen category
jq '. as $input | reduce ($input | sort_by(.generatedCategories | length | -.) | sort_by(.solveElapsedTimeMs / 20 | floor) | .[]) as $puzzle ({puzzles: [], categoriesSoFar: []}; . as $prevIter | ($prevIter.categoriesSoFar + $puzzle.generatedCategories | unique) as $newCategories | {puzzles: ($prevIter.puzzles + if ($newCategories | length) > ($prevIter.categoriesSoFar | length) then [$puzzle] else [] end), categoriesSoFar: $newCategories}) | .puzzles | sort_by(.title)' stats.json > puzzles/puzzles-ci.json
# Regenerate the json so the stats are removed
npx tsx tests/TestPuzzles.ts --printAll < puzzles/puzzles-ci.json > puzzles/puzzles-ci2.json; mv puzzles/puzzles-ci2.json puzzles/puzzles-ci.json
```

We pick the fastest puzzles here since in CI we are more concerned about code coverage, not benchmarking.

# puzzles-timeout.json

These are puzzles we would want to include in puzzles.json, but are currently too hard for the solver at the moment. As solver improvements are made, puzzles in this file should be moved to puzzles.json as they become solvable.

# lubaf-coloring-book.json

These are puzzles from Lubaf's coloring book set, published in the CtC discord puzzle archive.

#!/usr/bin/env python3

import json
import sys
from typing import TypedDict

# Input should look like this:
# [
#   [ # puzzle 1
#     [data1, data2, ...],  # base runs
#     [data1, data2, ...]   # head runs
#   ],
#   ...
# ]


class RunData(TypedDict):
    title: str
    author: str
    puzzle: str
    guesses: int
    solveElapsedTimeMs: int
    createElapsedTimeMs: int


PuzzleData = tuple[list[RunData], list[RunData]]
Data = list[PuzzleData]
data: list[PuzzleData] = json.load(sys.stdin)


def median(xs):
    return sorted(xs)[(len(xs) - 1) // 2]


def time(run: RunData) -> int:
    return run["solveElapsedTimeMs"] + run["createElapsedTimeMs"]


def median_guesses(runs: list[RunData]):
    return median([run["guesses"] for run in runs])


def median_time(runs: list[RunData]):
    return median([time(run) for run in runs])


def puzzle_title(puzzle: PuzzleData):
    return puzzle[0][0]["title"]


def puzzle_author(puzzle: PuzzleData):
    return puzzle[0][0]["author"]


def puzzle_localhost_link(puzzle: PuzzleData):
    return f'[{puzzle_title(puzzle)} by {puzzle_author(puzzle)}](http://localhost:8080/?load={puzzle[0][0]["puzzle"]})'


# positive delta = head had more guesses
def guesses_delta(puzzle: PuzzleData):
    return median_guesses(puzzle[1]) - median_guesses(puzzle[0])


# positive delta = head had more time
def time_delta(puzzle: PuzzleData):
    return median_time(puzzle[1]) - median_time(puzzle[0])


def print_table_in_markdown(headings: list[str], data: list[list[str]]):
    assert data
    assert len(headings) == len(data[0])
    print("|" + "|".join(headings) + "|")
    print("|" + "|".join(["-"] * len(headings)) + "|")
    for row in data:
        print("|" + "|".join(row) + "|")
    print()


# Sorted in increasing order of guesses delta (end of list = guesses increased the most)
by_guesses = sorted(
    data,
    key=guesses_delta,
)

# Sorted in increasing order of guesses delta (end of list = time increased the most)
by_time = sorted(
    data,
    key=time_delta,
)

best_guesses = [puzzle for puzzle in by_guesses[:3] if guesses_delta(puzzle) < 0]
print("## Guesses summary")
if not best_guesses:
    print("**No puzzles decreased in guesses.**")
else:
    print("Biggest decrease in guesses:")
    print()
    print_table_in_markdown(
        [
            "localhost puzzle link",
            "Median base guesses",
            "Median head guesses",
            "Guesses delta",
        ],
        [
            [
                puzzle_localhost_link(puzzle),
                str(median_guesses(puzzle[0])),
                str(median_guesses(puzzle[1])),
                str(guesses_delta(puzzle)),
            ]
            for puzzle in best_guesses
        ],
    )

worst_guesses = [puzzle for puzzle in by_guesses[-3:] if guesses_delta(puzzle) > 0]
worst_guesses.reverse()
if not worst_guesses:
    print("**No puzzles increased in guesses.**")
else:
    print("Biggest increase in guesses:")
    print()
    print_table_in_markdown(
        [
            "localhost puzzle link",
            "Median base guesses",
            "Median head guesses",
            "Guesses delta",
        ],
        [
            [
                puzzle_localhost_link(puzzle),
                str(median_guesses(puzzle[0])),
                str(median_guesses(puzzle[1])),
                str(guesses_delta(puzzle)),
            ]
            for puzzle in worst_guesses
        ],
    )

best_time = [puzzle for puzzle in by_time[:3] if time_delta(puzzle) < 0]
print("## Time summary")
if not best_time:
    print("**No puzzles decreased in time.**")
else:
    print("Biggest decrease in time:")
    print()
    print_table_in_markdown(
        [
            "localhost puzzle link",
            "Median base time",
            "Median head time",
            "Time delta",
        ],
        [
            [
                puzzle_localhost_link(puzzle),
                str(median_time(puzzle[0])),
                str(median_time(puzzle[1])),
                str(time_delta(puzzle)),
            ]
            for puzzle in best_time
        ],
    )

worst_time = [puzzle for puzzle in by_time[-3:] if time_delta(puzzle) > 0]
worst_time.reverse()
if not worst_time:
    print("**No puzzles increased in time.**")
else:
    print("Biggest increase in time:")
    print()
    print_table_in_markdown(
        [
            "localhost puzzle link",
            "Median base time",
            "Median head time",
            "Time delta",
        ],
        [
            [
                puzzle_localhost_link(puzzle),
                str(median_time(puzzle[0])),
                str(median_time(puzzle[1])),
                str(time_delta(puzzle)),
            ]
            for puzzle in worst_time
        ],
    )

#!/usr/bin/env python3

import json
import matplotlib.pyplot as plt
import matplotlib.markers as markers
import matplotlib.transforms as transforms
import seaborn as sns
import pandas as pd
from typing import TypedDict

import sys

# Usage:
# python3 gengraph.py 'lambda x: x["guesses"]' guesses.png < data.json
assert len(sys.argv) == 3

# Input "data.json" should look like this:
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

mapper_script = sys.argv[1]
outfilename = sys.argv[2]

mapper = eval(mapper_script)


def median(xs):
    xs = sorted(xs)
    return xs[(len(xs) - 1) // 2]


compare_data = pd.DataFrame(
    list(
        zip(
            (mapper(run) for puzzle in data for run in puzzle[0]),
            (mapper(run) for puzzle in data for run in puzzle[1]),
        )
    ),
    [median(mapper(run) for run in puzzle[0]) for puzzle in data for run in puzzle[0]],
    ["base", "head"],
)

sns.set(style="whitegrid")
fig, axd = plt.subplot_mosaic(
    [["left", "right"], ["bottom", "bottom"]],
    constrained_layout=True,
    figsize=(10, 10),
    dpi=140,
)

ax = sns.scatterplot(
    data=compare_data,
    markers={
        "base": markers.MarkerStyle(
            marker="X", transform=transforms.Affine2D().scale(0.8)
        ),
        "head": "*",
    },
    edgecolor="none",
    ax=axd["left"],
)
ax.set_xscale("log")
ax.set_yscale("log")

ax = sns.scatterplot(
    data=compare_data,
    markers={
        "base": markers.MarkerStyle(
            marker="X", transform=transforms.Affine2D().scale(0.8)
        ),
        "head": "*",
    },
    edgecolor="none",
    ax=axd["right"],
)

ax = sns.lineplot(
    data=pd.DataFrame(
        list(
            zip(
                [i + 1 for i in range(len(data))],
                sorted(median(mapper(run) for run in puzzle[0]) for puzzle in data),
            )
        ),
        columns=["y", "x"],
    ),
    y="y",
    x="x",
    marker=markers.MarkerStyle(marker="X", transform=transforms.Affine2D().scale(0.8)),
    markeredgecolor="none",
    ax=axd["bottom"],
)
ax = sns.lineplot(
    data=pd.DataFrame(
        list(
            zip(
                [i + 1 for i in range(len(data))],
                sorted(median(mapper(run) for run in puzzle[1]) for puzzle in data),
            )
        ),
        columns=["y", "x"],
    ),
    y="y",
    x="x",
    marker="*",
    markeredgecolor="none",
    ax=axd["bottom"],
)
ax.set_ylim(bottom=len(data) // 2, top=len(data) + 1)

plt.savefig(outfilename, format="png")

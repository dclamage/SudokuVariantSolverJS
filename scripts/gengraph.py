#!/usr/bin/env python3

import json
import matplotlib.pyplot as plt
import matplotlib.markers as markers
import matplotlib.transforms as transforms
import seaborn as sns
import pandas as pd

import sys

assert len(sys.argv) == 5

mapper_script = sys.argv[1]
base = json.load(open(sys.argv[2]))
head = json.load(open(sys.argv[3]))
outfilename = sys.argv[4]

mapper = eval(mapper_script)
basestats = list(map(mapper, base))
headstats = list(map(mapper, head))

compare_data = pd.DataFrame(
    list(zip(basestats, headstats)),
    basestats,
    ["base", "head"],
)


sortedbasestats = sorted(basestats)
sortedheadstats = sorted(headstats)

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
        list(zip([i + 1 for i in range(len(sortedbasestats))], sortedbasestats)),
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
        list(zip([i + 1 for i in range(len(sortedheadstats))], sortedheadstats)),
        columns=["y", "x"],
    ),
    y="y",
    x="x",
    marker="*",
    markeredgecolor="none",
    ax=axd["bottom"],
)
ax.set_ylim(bottom=len(sortedbasestats) // 2, top=len(sortedbasestats) + 1)

plt.savefig(outfilename, format="png")

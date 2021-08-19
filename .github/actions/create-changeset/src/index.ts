import path from "path";
import core from "@actions/core";
import github from "@actions/github";
import changesetsWrite from "@changesets/write";
import execa from "execa";
import { readPackageUpAsync } from "read-pkg-up";

type GithubContextPayload = typeof github.context.payload;
type GithubPullRequest = Pick<
  Required<GithubContextPayload>,
  "pull_request"
>["pull_request"];
type ChangesetType = "major" | "minor" | "patch";
interface PackageRelease {
  name: string;
  type: ChangesetType;
}

const ignoredFiles = ["package-lock.json", "yarn.lock"];

// Extracting default function because at this moment we can't find a way to import the esmodule instead of the commonjs
const write = ((changesetsWrite as unknown) as {
  default: typeof changesetsWrite;
}).default;

async function buildPackagesToRelease(
  pullRequest: GithubPullRequest,
  type: ChangesetType,
  ignoredPackages: string[]
): Promise<PackageRelease[]> {
  const { stdout } = await execa("git", [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    pullRequest.head.sha,
    pullRequest.base.sha,
  ]);
  const files = stdout.split("\n");
  const asyncPackageNames = files
    .filter((file) => !ignoredFiles.includes(file))
    .map(async (file) => {
      const cwd = path.dirname(file);
      const packageUpResult = await readPackageUpAsync({ cwd });
      if (
        !packageUpResult ||
        ignoredPackages.includes(packageUpResult.packageJson.name)
      ) {
        return null;
      }
      return packageUpResult.packageJson.name;
    });

  const packageNames = await Promise.all(asyncPackageNames);
  const uniquePackageNames = new Set(packageNames);
  const allUniquePackageNames = [...uniquePackageNames].filter(
    (x) => x
  ) as string[];

  return allUniquePackageNames.map((name) => ({ name, type }));
}

const buildChangesetSummary = (pullRequest: GithubPullRequest) => {
  const summary = pullRequest.title;
  if (!summary) throw new Error("Changeset summary could not be determined");
  return summary;
};

const buildChangesetType = async (
  pullRequest: GithubPullRequest
): Promise<ChangesetType | null> => {
  if (pullRequest.title.includes("BREAKING CHANGE")) {
    return "major";
  } else if (pullRequest.title.startsWith("feat")) {
    return "minor";
  } else if (pullRequest.title.startsWith("fix")) {
    return "patch";
  } else {
    return null;
  }
};

// Create the changeset.
const createChangeset = async (
  releases: { type: ChangesetType; name: string }[],
  summary: string
) => {
  const cwd = process.cwd();
  await write({ summary, releases }, cwd);
};

async function run() {
  // Try to extract changeset data from the workflow context.
  if (process.env.DEBUG) {
    core.debug("Context");
    core.debug(JSON.stringify(github.context));
  }

  // If we're not in a PR there's no point in running this action
  if (!github.context.payload.pull_request) {
    return;
  }

  const changesetType = await buildChangesetType(
    github.context.payload.pull_request
  );

  if (!changesetType) {
    core.info("Not adding changeset");
    return;
  }

  core.info(`Changeset type: ${changesetType}`);

  const ignoredPackages = github.context.payload.inputs?.ignoredPackages || [];

  const releases = await buildPackagesToRelease(
    github.context.payload.pull_request,
    changesetType,
    ignoredPackages
  );

  core.info(`Packages to release: ${JSON.stringify(releases)}`);

  const summary = buildChangesetSummary(github.context.payload.pull_request);

  await createChangeset(releases, summary);
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

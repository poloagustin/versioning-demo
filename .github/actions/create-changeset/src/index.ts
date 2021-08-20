import path from "path";
import core from "@actions/core";
import github from "@actions/github";
import changesetsWrite from "@changesets/write";
import { readPackageUpAsync } from "read-pkg-up";

type ChangesetType = "major" | "minor" | "patch";
interface PackageRelease {
  name: string;
  type: ChangesetType;
}

// Extracting default function because at this moment we can't find a way to import the esmodule instead of the commonjs
const write = ((changesetsWrite as unknown) as {
  default: typeof changesetsWrite;
}).default;

async function buildPackagesToRelease(
  type: ChangesetType,
  ignoredPackages: string[],
  paths: string[]
): Promise<PackageRelease[]> {
  const asyncPackageNames = paths.map(async (file) => {
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

const getCommitMessage = async () => {
  const githubToken = core.getInput("token");
  const octokit = github.getOctokit(githubToken);
  const summary = await octokit.git.getCommit({
    commit_sha: github.context.sha,
    ...github.context.repo,
  });
  if (!summary) throw new Error("Changeset summary could not be determined");
  return summary.data.message;
};

const buildChangesetType = async (
  commitMessage: string
): Promise<ChangesetType | null> => {
  if (commitMessage.includes("BREAKING CHANGE")) {
    return "major";
  } else if (commitMessage.startsWith("feat")) {
    return "minor";
  } else if (commitMessage.startsWith("fix")) {
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

  const commitMesage = await getCommitMessage();
  core.info(`Commit message: ${commitMesage}`);

  const changesetType = await buildChangesetType(commitMesage);

  if (!changesetType) {
    core.info("Not adding changeset");
    return;
  }

  core.info(`Changeset type: ${changesetType}`);

  const _ignoredPackages = core.getInput("ignoredPackages");
  const ignoredPackages = _ignoredPackages
    ? JSON.parse(_ignoredPackages).split(",")
    : [];
  const _paths = core.getInput("paths");
  const paths = _paths ? JSON.parse(_paths) : [];
  core.info("Will work with following paths");
  core.info(_paths);

  const releases = await buildPackagesToRelease(
    changesetType,
    ignoredPackages,
    paths
  );

  core.info(`Packages to release: ${JSON.stringify(releases)}`);

  await createChangeset(releases, commitMesage);
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

import core from "@actions/core";
import github from "@actions/github";
import execa from "execa";
import { resolve } from "path";
import { readFile } from "fs/promises";

interface PackageToTag {
  name: string;
  version: string;
}

let octokitSingleton: ReturnType<typeof github.getOctokit>;

const symendPackageNameStart = "@symend/";

export function getOctokitSingleton() {
  if (octokitSingleton) {
    return octokitSingleton;
  }
  const githubToken = core.getInput("token");
  octokitSingleton = github.getOctokit(githubToken);
  return octokitSingleton;
}

export async function createTag(newTag: string) {
  const octokit = getOctokitSingleton();

  core.debug(`Pushing new tag to the repo.`);
  await octokit.git.createRef({
    ...github.context.repo,
    ref: `refs/tags/${newTag}`,
    sha: github.context.sha,
  });
}

async function buildPackagesToTag(): Promise<PackageToTag[]> {
  const { stdout } = await execa("git", [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    "HEAD",
    "HEAD~1",
  ]);
  const files = stdout.split("\n");
  const packages = files
    .filter((file) => file.endsWith("package.json"))
    .map(async (file) => {
      core.info(file);
      const packageJsonDir = resolve(process.cwd(), file);
      core.info(packageJsonDir);
      const loadedFile = await readFile(packageJsonDir, "utf-8");
      const jsonFile = JSON.parse(loadedFile);
      return {
        name: jsonFile.name,
        version: jsonFile.version,
      };
    });

  const packageNames = await Promise.all(packages);

  return packageNames;
}

const tag = async (packages: PackageToTag[]) => {
  for (const projectPackage of packages) {
    core.info(
      `Creating tag for project package name: ${projectPackage.name} version: ${projectPackage.version}.`
    );
    await createTag(
      `${projectPackage.name.replace(symendPackageNameStart, "")}/${
        projectPackage.version
      }`
    );
    core.info(
      `Tag created for project package name: ${projectPackage.name} version: ${projectPackage.version}.`
    );
  }
};

async function run() {
  // Try to extract changeset data from the workflow context.
  if (process.env.DEBUG) {
    core.debug("Context");
    core.debug(JSON.stringify(github.context));
  }

  const packages = await buildPackagesToTag();

  await tag(packages);
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

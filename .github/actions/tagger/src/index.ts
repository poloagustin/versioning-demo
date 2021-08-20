import core from "@actions/core";
import github from "@actions/github";
import execa from "execa";
import { dirname, resolve } from "path";
import { readFile } from "fs/promises";

interface PackageToTag {
  name: string;
  version: string;
}

let octokitSingleton: ReturnType<typeof github.getOctokit>;

const getPackageScope = () => core.getInput("packageScope");

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

async function buildPackagesToTag(paths: string[]): Promise<PackageToTag[]> {
  const packages = paths.map(async (file) => {
    core.info(file);
    const packageJsonDir = dirname(resolve(process.cwd(), file));
    const packageJsonPath = resolve(packageJsonDir, "package.json");
    core.info(packageJsonPath);
    const loadedFile = await readFile(packageJsonPath, "utf-8");
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
      `${projectPackage.name.replace(`@${getPackageScope()}/`, "")}/${
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

  const _paths = core.getInput("paths");
  const paths = _paths ? JSON.parse(_paths) : [];

  const packages = await buildPackagesToTag(paths);

  await tag(packages);
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

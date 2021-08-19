import core from '@actions/core';
import github from '@actions/github';
import execa from 'execa';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageToTag {
  name: string;
  version: string;
}

let octokitSingleton: ReturnType<typeof github.getOctokit>;

const symendPackageNameStart = '@symend/';

export function getOctokitSingleton() {
  if (octokitSingleton) {
    return octokitSingleton;
  }
  const githubToken = core.getInput('github_token');
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
  const { stdout } = await execa('git', [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    'HEAD',
    'HEAD~1',
  ]);
  const files = stdout.split('\n');
  const packages = files
    .filter((file) => file.endsWith('package.json'))
    .map(async (file) => {
      console.log(file);
      core.info(file);
      const packageJsonDir = resolve(__dirname, file);
      console.log(packageJsonDir);
      core.info(packageJsonDir);
      return import(packageJsonDir).then((packageJson) => ({
        name: packageJson.name,
        version: packageJson.version,
      }));
    });

  const packageNames = await Promise.all(packages);

  return packageNames;
}

const tag = async (packages: PackageToTag[]) => {
  for (const projectPackage of packages) {
    core.info(
      `Creating tag for project package name: ${projectPackage.name} version: ${projectPackage.version}.`,
    );
    await createTag(
      `${projectPackage.name.replace(symendPackageNameStart, '')}v${
        projectPackage.version
      }`,
    );
    core.info(
      `Tag created for project package name: ${projectPackage.name} version: ${projectPackage.version}.`,
    );
  }
};

async function run() {
  // Try to extract changeset data from the workflow context.
  if (process.env.DEBUG) console.debug('Context', github.context);

  const packages = await buildPackagesToTag();

  await tag(packages);
}

run().catch((err) => {
  console.error(err);
  core.setFailed(err.message);
});

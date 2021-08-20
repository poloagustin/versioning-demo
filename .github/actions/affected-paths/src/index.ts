import core from "@actions/core";
import execa from "execa";
import { dirname, resolve } from "path";

async function buildAffectedPackages(
  head: string,
  base: string,
  filter?: RegExp
): Promise<string[]> {
  const { stdout } = await execa("git", [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    head,
    base,
  ]);
  const files = stdout.split("\n");
  const filteredFiles = filter
    ? files.filter((file) => filter.test(file))
    : files;
  const paths = filteredFiles.map((file) => {
    core.info(file);
    const packageJsonDir = dirname(resolve(process.cwd(), file));
    return packageJsonDir;
  });

  const uniquePaths = new Set(paths);
  const allUniquePaths = [...uniquePaths];

  return allUniquePaths;
}

async function run() {
  const head = core.getInput("head");
  const base = core.getInput("base");
  const _filter = core.getInput("filter");
  const filter = _filter ? new RegExp(_filter, "g") : undefined;

  const packages = await buildAffectedPackages(head, base, filter);

  core.setOutput("packages", packages);
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

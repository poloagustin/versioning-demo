import core from "@actions/core";
import github from "@actions/github";

const getPaths = (): string[] => {
  const _paths = core.getInput("paths");
  return _paths ? JSON.parse(_paths) : [];
};

const getEnvironmentName = () => core.getInput("environmentName");

const getOctokit = () => github.getOctokit(core.getInput("token"));

const upsertPullRequests = async () => {
  const octokit = getOctokit();

  const pulls = getPaths().map(async (path) => {
    const pathParts = path.split("/");
    const packageName = pathParts[pathParts.length - 1];
    const repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const head = github.context.ref.replace("refs/heads/", "");
    const environmentName = getEnvironmentName();
    const base = `${environmentName}/${packageName}`;
    const searchQuery = `repo:${repo}+state:open+head:${head}+base:${base}`;
    core.info(`searchQuery --- ${searchQuery}`);
    const queryResult = await octokit.search.issuesAndPullRequests({
      q: searchQuery,
    });

    if (queryResult.data.total_count) {
      return;
    }

    const title = `Deploy ${packageName} to ${environmentName}`;
    const body = "";
    const pullRequestPayload = {
      head,
      base,
      title,
      body,
      ...github.context.repo,
    };

    core.info("create PR");
    core.info(JSON.stringify(pullRequestPayload));

    return octokit.pulls.create(pullRequestPayload);
  });

  await Promise.all(pulls);
};

async function run() {
  // Try to extract changeset data from the workflow context.
  if (process.env.DEBUG) {
    core.debug("Context");
    core.debug(JSON.stringify(github.context));
  }

  await upsertPullRequests();
}

run().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});

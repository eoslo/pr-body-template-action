const core = require('@actions/core');
const github = require('@actions/github');
const {readdirSync, readFileSync} = require("fs");

async function run() {
    try {
        if (github.context.eventName !== 'pull_request') {
            core.info('[!] Commenting only works on pull_request event!');
            return;
        }

        // Get the PR context
        const issue = github.context.issue;
        const branch = github.context.payload.pull_request.head.ref;

        // Get the actions configs
        const mapping = core.getInput('mapping');
        const template_dir = core.getInput('template_dir');
        const default_template = core.getInput('default');
        const templates = readdirSync(template_dir);

        // Prepare the API client
        const token = core.getInput('token');
        const octokit = new github.GitHub(token);

        // Check if there's an existing comment already...
        let comments = (
            await octokit.issues.listComments({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
            })
        ).data.filter(comment => comment.user.login === 'github-actions[bot]');

        if (comments.length !== 0) {
            core.info('[!] The bot has already commented on this PR!');
            return;
        }

        let foundPrefix;

        if (mapping) {
            const mappingArr = mapping.split(';').map((curr) => {
                const [name, prefixes] = curr.split('=');
                return {
                    file: name,
                    prefixes: prefixes.split(',')
                }
            });

            foundPrefix = mappingArr.find((item) => item.prefixes.some((prefix) => branch.startsWith(prefix)))
        }

        const filename = `${foundPrefix ? foundPrefix.file : default_template}.md`;

        if (!templates.includes(filename)) {
            core.setFailed(`Could not find template: ${filename}!`);
            return;
        }

        update_with_template(octokit, issue, template_dir, filename);
    } catch (error) {
        core.setFailed(error.message);
    }
}

/**
 * Post a comment with the content of `filename` to a given GitHub issue.
 */
function update_with_template(octokit, issue, template_dir, filename) {
    let file_content = readFileSync(`${template_dir}${filename}`, {encoding: "utf8"});
    octokit.pulls.update({
        owner: issue.owner,
        repo: issue.repo,
        pull_number: issue.number,
        body: `${file_content}`,
    });
    octokit.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: "No olvidarse de completar la descripcion del pr!",
    });
}

run()

# Public demo on GitHub Pages

This publishes the self-contained Orbit concept demo, not the private repository or the design documentation. The intended URL is `https://natanelia.github.io/dom-director/`. A configured workflow is not evidence of a live deployment; check the latest **Deploy public demo** run and its public-access verification step.

## One-time account setup

In [Settings > Pages](https://github.com/natanelia/dom-director/settings/pages), under **Build and deployment**, select **GitHub Actions** as the source. Leave repository visibility private. A private source repository needs an eligible GitHub plan (for this personal repository, GitHub Pro or an applicable enterprise plan). Do not change repository visibility or upgrade a plan without the owner's explicit approval.

The ordinary Actions `GITHUB_TOKEN` cannot activate a Pages site for the first time. The workflow intentionally does not attempt to work around that restriction or request a personal access token.

After enabling Pages, open [Deploy public demo](https://github.com/natanelia/dom-director/actions/workflows/deploy-pages.yml), choose **Run workflow**, select `main`, and run it. A successful run reports the actual URL. If an initial run failed during Pages configuration, rerunning its failed job after activation is also supported while its artifact remains available.

## Automatic deployment

Changes under `demo/`, changes to the deployment workflow, or changes to `LICENSE` on `main` trigger publication. Manual runs are supported on `main` only. Pull requests and other branches are not deployed.

Before publication, the workflow rebuilds the HTML, rejects a stale committed bundle, checks JavaScript syntax, runs the 10 pure-model tests and the 14 Chromium fixture tests, then prepares an allowlisted artifact. It uses pinned action revisions and keeps deployment credentials out of the build job. The existing **Design and demo checks** workflow remains unchanged.

Only these files are public:

- `index.html`: the demo, including its browser JavaScript, styling, fictional fixture data, and embedded placeholder narration.
- `LICENSE.txt`: the MIT license notice.
- `.nojekyll`: the static-site marker.

The source folders, design documents, tests, scripts, Git metadata, and private repository history are not copied into the Pages artifact. The browser code inside the public HTML is necessarily readable by visitors. No analytics, new external assets, or API keys are added by deployment.

## Verification and rollback

The deploy job fetches the resulting URL without authentication and verifies the DOM Director page text. If this check fails, inspect the deployment and HTTP response before claiming success. Existing browser tests validate the demo fixture; they do not establish a full browser or accessibility certification.

To roll back content, revert the relevant demo commit on `main` and allow the workflow to redeploy. To stop public hosting, an authorized repository administrator can unpublish the site from Pages settings. Never make the repository public as an automatic fallback.

## References

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages availability and creating a site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configure Pages enablement permissions](https://github.com/actions/configure-pages/blob/v5/action.yml)

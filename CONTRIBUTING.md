# Contributing to UHD

Thanks for your interest in **Universal Hardware Description (UHD)**. UHD is meant to be a shared, multidisciplinary description language for hardware — it gets better the more eyes and use cases shape it.

## Code of conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report unacceptable behavior to **mark@deltaroboticsinc.com**.

## Ways to contribute

- **Report bugs** — file an issue using the bug-report template.
- **Propose schema changes** — open a discussion or feature-request issue *before* opening a PR. UHD's data model is the load-bearing part of the project; changes need design conversation first.
- **Fix bugs / add tests** — small PRs welcome without prior discussion.
- **Improve docs** — clarifications, examples, and corrections in `docs/` or the README are always appreciated.
- **Add domain examples** — fixtures under `test/fixtures/` (Arduino, motors, sensors, etc.) showcase UHD across domains; new ones help.

## Development setup

```bash
git clone https://github.com/Delta-Robotics-Inc/uhd
cd uhd
npm install
```

### Common commands

```bash
npm test            # Run the full test suite
npm run test:watch  # Watch mode
npm run type-check  # Strict TypeScript check (no emit)
npm run build       # Compile to dist/
```

All tests live under `test/` and are organized by validation phase (protocol matching, composition, binding, parameters, modules).

## Pull request process

1. Fork the repo and create a feature branch off `main`.
2. Make your changes. Keep PRs focused — one logical change per PR.
3. Add or update tests covering your change.
4. Run `npm test` and `npm run type-check` locally; both must pass.
5. Update `CHANGELOG.md` under the `## [Unreleased]` heading. Leave the version in `package.json` alone; a release changes it (see [Releasing](#releasing)).
6. Open a PR. Fill in the PR template; link any related issue.
7. A maintainer will review. Schema-affecting PRs may need iteration before merge.

## Releasing

Maintainers release `@deltarobotics/uhd` to npmjs. Four rules keep a version number meaning one thing:

1. **A tag is the release.** `main` may be ahead of the latest release. The tag `v<version>` marks exactly which commit that release is.
2. **Only a tagged commit is published under a plain version number, and CI publishes it.** Pushing the tag runs `.github/workflows/release.yml`. Nobody runs `npm publish` from a branch or a laptop.
3. **A build of an untagged commit never carries a plain version.** If it has to go into a registry, it is versioned `<next version>-dev.<short sha>`, such as `0.4.0-dev.1a2b3c4`, which cannot be mistaken for a release.
4. **New work stays under `## [Unreleased]`** in `CHANGELOG.md` until the release commit moves it under a version heading. `main` stays releasable. An urgent fix to an old release branches from its tag.

### Cutting a release

1. On a branch off `main`, set the version: `npm version <version> --no-git-tag-version` (it updates `package.json` and `package-lock.json`). Before 1.0, a change to the schema or a removal is a minor version; anything else may be a patch.
2. In `CHANGELOG.md`, add the heading `## [<version>] — <YYYY-MM-DD>` under `## [Unreleased]` and move every entry under it, so `## [Unreleased]` is left empty. Update the version in the README's status badge and "Project status".
3. Run `node scripts/check-release.mjs v<version>`. It checks what CI will check: the tag is `v<semver>`, `package.json` states it, the changelog has the dated heading with entries, and nothing is left under `## [Unreleased]`.
4. Open the pull request and merge it to `main`. CI runs the same script in its pull-request mode and `npm pack --dry-run` on every change, so a version without a heading or a package that does not pack is caught here.
5. Tag the merged commit and push the tag:

   ```bash
   git switch main && git pull
   git tag v<version>
   git push origin v<version>
   ```

6. The tag starts the release workflow. It refuses a tag whose commit is not in `main`, then installs, type-checks, tests, builds, runs the release check, publishes to npmjs with provenance, and creates the GitHub release with the changelog section as its notes.
7. Verify: `npm view @deltarobotics/uhd version dist-tags` shows the version as `latest`, the package page on npmjs shows the provenance of the build, and the repository's Releases page has `v<version>`.

If the workflow fails for a reason outside the commit (publishing rights not set up yet, npmjs unreachable) or after publishing (npmjs has the version but there is no GitHub release), fix that and re-run the workflow: it skips what is already done. If the commit itself is at fault, fix it on `main` and release the fix as the next version; do not move a tag that was pushed.

### Patch release of an older version

When `main` has moved on and an older release needs a fix:

1. Branch from its tag, with a name starting `release/`: `git switch -c release/0.3 v0.3.0`, and push the branch.
2. Make the fix there (a pull request into `release/0.3`), with the version bump and changelog heading as above.
3. Tag the commit on that branch (`v0.3.1`) and push the tag. The workflow accepts a tagged commit that is in `main` or in a `release/*` branch, and nothing else.
4. A patch of an older line is published under the dist-tag `release-<major>.<minor>` (here `release-0.3`), so `latest` stays on the newest release. Bring the fix to `main` with its own pull request.

### Prereleases and dev builds

- **Prerelease**: a version with a hyphen, such as `1.0.0-rc.1`, tagged `v1.0.0-rc.1` and released like any other. It is published under the dist-tag `next`, not `latest`, and marked as a prerelease on GitHub. It needs its own changelog heading, and may leave entries under `## [Unreleased]`.
- **Dev build**: a build of an untagged commit. It is never published to npmjs and never tagged; the release check refuses a `-dev.` tag.

`package.json` names no registry. A tool that needs an unreleased build in a registry of its own (a private mirror, a local test registry) packs the package (`npm pack`; `prepack` builds `dist/`) and publishes the tarball with an explicit `npm publish <tarball> --registry <url>`, so nothing in this repository points at it. Rule 3 holds for those mirrors too: a mirror carries a plain version only when it was built from the commit tagged with that version, and any other build is published as `<next version>-dev.<short sha>`, with the tools that depend on it pinning that exact version.

### One-time setup for maintainers

Publishing works with either of the following, and the workflow needs no edit to switch between them:

- **npm trusted publishing** (preferred, no secret to keep). On npmjs, open the package's Settings, and under "Trusted Publisher" choose GitHub Actions with organization or user `Delta-Robotics-Inc`, repository `OpenUHD`, workflow filename `release.yml`, and no environment.
- **A token.** Create a granular access token on npmjs that may read and write `@deltarobotics/uhd` only, and store it as the repository secret `NPM_TOKEN` (GitHub: Settings, Secrets and variables, Actions). The workflow uses the secret only when it is set.

And for the package itself:

- Every maintainer's npm account signs in with two-factor authentication.
- The package has at least two maintainers on npmjs (`npm owner ls @deltarobotics/uhd`), so a release never depends on one person's account.

## Schema changes

UHD is heading toward a stable 1.0. Until then, the data model may evolve, but each change should:

- Be motivated by a real use case (cite the example).
- Update [docs/architecture.md](docs/architecture.md) in the same PR.
- Include a migration note in `CHANGELOG.md` if it breaks existing definitions.

## Style

- TypeScript, strict mode. Match the existing voice of the codebase — domain-neutral terms (Module / Interface / Harness / Protocol / Capability), no domain-specific jargon in core types.
- Prefer adding tests over adding comments. The data model is small; readable code is preferable to documentation.
- No code formatter is currently enforced; match surrounding style.

## License

By contributing, you agree your contributions will be licensed under the [Apache License 2.0](LICENSE). You retain copyright; the license is in addition.

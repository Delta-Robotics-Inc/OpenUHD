import { afterAll, describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../scripts/check-release.mjs");
const REPOSITORY = { type: "git", url: "git+https://github.com/acme/widgets.git" };

const RELEASED = `# Changelog

## [Unreleased]

## [1.2.0] — 2026-03-04

Second release.

### Added

- Gears.

## [1.1.0] — 2026-01-02

### Added

- Levers.
`;

const roots: string[] = [];
afterAll(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A package directory with the three files the check reads. */
function fixture(opts: { version?: string; lockVersion?: string | null; changelog?: string } = {}): string {
  const version = opts.version ?? "1.2.0";
  const dir = mkdtempSync(join(tmpdir(), "uhd-check-release-"));
  roots.push(dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@acme/widgets", version, repository: REPOSITORY }));
  if (opts.lockVersion !== null) {
    const locked = opts.lockVersion ?? version;
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ name: "@acme/widgets", version: locked, packages: { "": { version: locked } } }));
  }
  writeFileSync(join(dir, "CHANGELOG.md"), opts.changelog ?? RELEASED);
  return dir;
}

/** Runs the check outside any CI environment unless `env` says otherwise. */
function run(root: string, args: string[], env: Record<string, string> = {}) {
  const clean = { ...process.env };
  for (const name of ["GITHUB_ACTIONS", "GITHUB_REF_NAME", "GITHUB_REF_TYPE", "GITHUB_REPOSITORY"]) delete clean[name];
  const r = spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8", env: { ...clean, ...env } });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

describe("release check: a tag releases the commit it is on", () => {
  it("passes when the tag, package.json, the lockfile and the changelog agree", () => {
    const r = run(fixture(), ["v1.2.0"]);
    expect(r).toMatchObject({ status: 0, err: "" });
    expect(r.out).toContain("v1.2.0 releases @acme/widgets 1.2.0 (dist-tag latest)");
  });

  it("reads the tag from GITHUB_REF_NAME when CI runs for a tag", () => {
    const tag = { GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "v1.2.0" };
    expect(run(fixture(), [], tag).out).toContain("v1.2.0 releases");
    expect(run(fixture(), [], { ...tag, GITHUB_REF_NAME: "v1.3.0" }).status).toBe(1);
  });

  it("refuses a tag that is not v<semver>", () => {
    for (const tag of ["1.2.0", "v1.2", "release-1.2.0", "v01.2.0", "v1.2.0+build.5"]) {
      const r = run(fixture(), [tag]);
      expect(r.status, tag).toBe(1);
      expect(r.err, tag).toContain("is not a release tag");
    }
  });

  it("refuses a dev build: it names an untagged build, never a release", () => {
    const r = run(fixture({ version: "1.2.0-dev.abc1234" }), ["v1.2.0-dev.abc1234"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("is a dev build");
  });

  it("refuses a tag that package.json does not state", () => {
    const r = run(fixture({ version: "1.1.0" }), ["v1.2.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("The tag is v1.2.0 but package.json states version 1.1.0");
  });

  it("refuses a lockfile that states another version", () => {
    const r = run(fixture({ lockVersion: "1.1.0" }), ["v1.2.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("package-lock.json states version 1.1.0, package.json states 1.2.0");
    expect(run(fixture({ lockVersion: null }), ["v1.2.0"]).status).toBe(0);
  });

  it("refuses a version without a changelog heading", () => {
    const r = run(fixture({ version: "1.3.0" }), ["v1.3.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain('CHANGELOG.md has no "## [1.3.0] — <date>" heading');
  });

  it("refuses a heading without a real date", () => {
    for (const heading of ["## [1.2.0]", "## [1.2.0] — soon", "## [1.2.0] — 2026-02-30"]) {
      const r = run(fixture({ changelog: RELEASED.replace("## [1.2.0] — 2026-03-04", heading) }), ["v1.2.0"]);
      expect(r.status, heading).toBe(1);
      expect(r.err, heading).toContain("needs the release date");
    }
  });

  it("refuses a section with no entries; subheadings alone are not entries", () => {
    const empty = "# Changelog\n\n## [Unreleased]\n\n## [1.2.0] — 2026-03-04\n\n### Added\n\n## [1.1.0] — 2026-01-02\n\n- Levers.\n";
    const r = run(fixture({ changelog: empty }), ["v1.2.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("the section of 1.2.0 is empty");
  });

  it("refuses a release that left entries under Unreleased", () => {
    const left = RELEASED.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Fixed\n\n- Forgotten.\n");
    const r = run(fixture({ changelog: left }), ["v1.2.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain('"## [Unreleased]" still has 1 line(s) of entries');
    // Subheadings without entries under them are an empty section.
    expect(run(fixture({ changelog: RELEASED.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Added\n") }), ["v1.2.0"]).status).toBe(0);
  });

  it("lets a prerelease leave entries under Unreleased, and publishes it as next", () => {
    const changelog = RELEASED.replace("## [Unreleased]\n", "## [Unreleased]\n\n- Still collecting.\n\n## [1.3.0-rc.1] — 2026-04-01\n\n- Preview of cams.\n");
    const r = run(fixture({ version: "1.3.0-rc.1", changelog }), ["v1.3.0-rc.1"]);
    expect(r).toMatchObject({ status: 0, err: "" });
    expect(r.out).toContain("(dist-tag next)");
  });

  it("in GitHub Actions, refuses a package.json that names another repository", () => {
    const ci = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "acme/widgets" };
    expect(run(fixture(), ["v1.2.0"], ci).status).toBe(0);
    const r = run(fixture(), ["v1.2.0"], { ...ci, GITHUB_REPOSITORY: "acme/gadgets" });
    expect(r.status).toBe(1);
    expect(r.err).toContain("repository is acme/widgets, but this is acme/gadgets");
  });

  it("reports every problem at once", () => {
    const r = run(fixture({ version: "1.1.0", lockVersion: "1.0.0" }), ["v1.3.0"]);
    expect(r.err.trim().split("\n")).toHaveLength(3);
  });
});

describe("release check: pull requests", () => {
  it("passes for a released version with new work under Unreleased", () => {
    const changelog = RELEASED.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Added\n\n- Cams.\n");
    const r = run(fixture({ changelog }), ["--pr", "--latest-tag", "v1.2.0"]);
    expect(r).toMatchObject({ status: 0, err: "" });
    expect(r.out).toContain("released as v1.2.0, 1 line(s) under Unreleased");
  });

  it("passes for a change that prepares a release: bumped version with its heading", () => {
    const r = run(fixture(), ["--pr", "--latest-tag", "v1.1.0"]);
    expect(r).toMatchObject({ status: 0, err: "" });
    expect(r.out).toContain("not tagged yet (latest release tag: v1.1.0)");
  });

  it("passes for the latest tag's version even when the changelog never got its heading", () => {
    const changelog = "# Changelog\n\n## [Unreleased]\n\n- Cams.\n";
    expect(run(fixture({ changelog }), ["--pr", "--latest-tag", "v1.2.0"]).status).toBe(0);
  });

  it("refuses a version that was bumped without a changelog heading", () => {
    const r = run(fixture({ version: "1.3.0" }), ["--pr", "--latest-tag", "v1.2.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("package.json states version 1.3.0, which has no heading in CHANGELOG.md and is not the latest release (v1.2.0)");
  });

  it("says so when it needs the latest tag and cannot find one", () => {
    // The fixture is not a git repository, so there is no tag to read.
    const r = run(fixture({ version: "1.3.0" }), []);
    expect(r.status).toBe(1);
    expect(r.err).toContain("no release tag found");
  });

  it("refuses a version heading without a date or entries", () => {
    const r = run(fixture({ changelog: RELEASED.replace("## [1.2.0] — 2026-03-04", "## [1.2.0]") }), ["--pr", "--latest-tag", "v1.1.0"]);
    expect(r.status).toBe(1);
    expect(r.err).toContain("needs the release date");
  });

  it("refuses a changelog without an Unreleased section, a mismatched lockfile, a version that is not semver", () => {
    expect(run(fixture({ changelog: RELEASED.replace("## [Unreleased]\n\n", "") }), ["--pr"]).err).toContain('no "## [Unreleased]" heading');
    expect(run(fixture({ lockVersion: "1.1.0" }), ["--pr"]).err).toContain("package-lock.json states version 1.1.0");
    expect(run(fixture({ version: "1.2" }), ["--pr"]).err).toContain("is not a semantic version");
  });

  it("is the mode CI gets for a branch: GITHUB_REF_NAME is only a tag when GITHUB_REF_TYPE says so", () => {
    const r = run(fixture(), ["--latest-tag", "v1.2.0"], { GITHUB_REF_TYPE: "branch", GITHUB_REF_NAME: "v1.9.9" });
    expect(r.status).toBe(0);
    expect(r.out).toContain("is consistent");
  });
});

describe("release check: notes and dist-tag", () => {
  it("prints a version's changelog section, without its heading, for the release notes", () => {
    const r = run(fixture(), ["--notes", "v1.2.0"]);
    expect(r.status).toBe(0);
    expect(r.out).toBe("Second release.\n\n### Added\n\n- Gears.\n");
    expect(run(fixture(), ["--notes", "1.1.0"]).out).toBe("### Added\n\n- Levers.\n");
  });

  it("fails for a version the changelog does not have", () => {
    const r = run(fixture(), ["--notes", "v9.9.9"]);
    expect(r).toMatchObject({ status: 1, out: "" });
  });

  it("names the dist-tag: next for a prerelease, latest for the newest release, a line's own tag for an older patch", () => {
    const tag = (...args: string[]) => run(fixture(), ["--dist-tag", ...args]).out.trim();
    expect(tag("v1.3.0-rc.1", "--latest", "1.2.0")).toBe("next");
    expect(tag("v1.3.0", "--latest", "1.2.0")).toBe("latest");
    expect(tag("v1.3.0")).toBe("latest");
    expect(tag("v1.10.0", "--latest", "1.9.0")).toBe("latest");
    expect(tag("v1.1.1", "--latest", "1.2.0")).toBe("release-1.1");
  });

  it("refuses options it does not know", () => {
    expect(run(fixture(), ["--publish"]).status).toBe(2);
  });
});

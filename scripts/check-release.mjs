#!/usr/bin/env node
// Release check for @deltarobotics/uhd. Plain Node, no dependencies.
//
//   node scripts/check-release.mjs v0.3.0        check that this commit is release 0.3.0
//   node scripts/check-release.mjs               the same for the tag in GITHUB_REF_NAME when CI
//                                                runs for a tag (GITHUB_REF_TYPE=tag); otherwise
//                                                the pull-request check
//   node scripts/check-release.mjs --pr          pull-request check: is the version consistent?
//   node scripts/check-release.mjs --notes v0.3.0     print the changelog section of a version
//   node scripts/check-release.mjs --dist-tag v0.3.0 [--latest 0.2.0]
//                                                print the npm dist-tag the version is published under
//
// Options: --root <dir> (the package to check, default: this repository),
//          --latest-tag <tag> (pull-request check: the latest release tag, instead of asking git).
//
// Release check. A tag releases the commit it is on when
//   1. the tag is v<semver>, with no build metadata, and is not a dev build
//      (<version>-dev.<sha> names an untagged build in a mirror, never a release);
//   2. package.json (and package-lock.json) state that version;
//   3. CHANGELOG.md has a heading "## [<version>] — <YYYY-MM-DD>" with at least one entry;
//   4. for a version without a prerelease part, "## [Unreleased]" has no entries.
//      The release commit moves every entry under the version heading, so anything
//      still under Unreleased at the tagged commit is an entry the release forgot.
//      Work merged after the release commit is not in the tagged commit and is
//      not affected. A prerelease (1.0.0-rc.1) may leave entries under Unreleased:
//      it previews work that is still collecting.
//   5. in GitHub Actions, package.json's repository is the repository the
//      workflow runs in (npm refuses provenance for any other).
//
// Pull-request check. The version is consistent when package.json and
// package-lock.json agree, CHANGELOG.md has "## [Unreleased]", and either
//   a. CHANGELOG.md has a dated heading with entries for package.json's version
//      (the version is released, or this change prepares its release), or
//   b. the version is the one of the latest release tag (nothing was bumped, and
//      new work is under Unreleased).
// A version that was bumped without a changelog heading fails.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

/** A version's parts, or null when it is not a semantic version (build metadata is not accepted). */
function parseVersion(version) {
  const m = SEMVER.exec(version ?? "");
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ? m[4].split(".") : [] };
}

/** Semantic-version precedence: negative when a < b, positive when a > b. */
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (const k of ["major", "minor", "patch"]) if (x[k] !== y[k]) return x[k] - y[k];
  if (!x.prerelease.length || !y.prerelease.length) return y.prerelease.length - x.prerelease.length;
  for (let i = 0; i < Math.max(x.prerelease.length, y.prerelease.length); i++) {
    const p = x.prerelease[i];
    const q = y.prerelease[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** The changelog's sections: `{ name, date, entries, text }` per "## [name]" heading, in file order. */
function changelogSections(changelog) {
  const sections = [];
  let current = null;
  for (const line of changelog.split(/\r?\n/)) {
    if (/^## /.test(line)) {
      const m = /^## \[([^\]]+)\](?:\s+[—–-]\s+(.+?))?\s*$/.exec(line);
      current = { name: m ? m[1] : line.slice(3).trim(), date: m?.[2], lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections.map(({ name, date, lines }) => ({
    name,
    date,
    // An entry is any line that says something: not blank, not a "### Added" style subheading.
    entries: lines.filter((l) => l.trim() && !/^#{3,} /.test(l)).length,
    text: lines.join("\n").trim(),
  }));
}

function isDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? "")) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Problems with the changelog section of `version` (empty when it is a dated section with entries). */
function sectionProblems(sections, version) {
  const section = sections.find((s) => s.name === version);
  if (!section) return [`CHANGELOG.md has no "## [${version}] — <date>" heading. Move the entries of this release from "## [Unreleased]" under that heading.`];
  const problems = [];
  if (!isDate(section.date)) problems.push(`CHANGELOG.md: the heading of ${version} needs the release date, as "## [${version}] — YYYY-MM-DD"${section.date ? ` (found "${section.date}")` : ""}.`);
  if (!section.entries) problems.push(`CHANGELOG.md: the section of ${version} is empty. A release says what changed.`);
  return problems;
}

function versionProblems(pkg, lock) {
  const problems = [];
  if (!parseVersion(pkg.version)) problems.push(`package.json: version "${pkg.version}" is not a semantic version (major.minor.patch, with an optional -prerelease).`);
  if (lock) {
    const locked = [lock.version, lock.packages?.[""]?.version].filter((v) => v !== undefined);
    if (locked.some((v) => v !== pkg.version)) problems.push(`package-lock.json states version ${locked.find((v) => v !== pkg.version)}, package.json states ${pkg.version}. Run "npm install --package-lock-only".`);
  }
  return problems;
}

/** "owner/name" of a GitHub repository URL as package.json writes it. */
function repositorySlug(repository) {
  const url = typeof repository === "string" ? repository : repository?.url;
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url ?? "");
  return m?.[1];
}

/** Problems that keep `tag` from releasing this commit. */
function checkRelease({ tag, pkg, lock, changelog, repository }) {
  const version = /^v(.+)$/.exec(tag ?? "")?.[1];
  const parsed = parseVersion(version);
  if (!parsed) return [`"${tag}" is not a release tag. A release tag is v<version>, such as v1.2.3 or v1.2.3-rc.1.`];
  if (parsed.prerelease[0] === "dev") return [`"${tag}" is a dev build. <version>-dev.<sha> names an untagged build in a mirror and is never released; tag a release (v1.2.3) or a prerelease (v1.2.3-rc.1).`];
  const problems = [];
  if (pkg.version !== version) problems.push(`The tag is ${tag} but package.json states version ${pkg.version}. Tag the commit whose package.json states ${version}.`);
  problems.push(...versionProblems(pkg, lock));
  const sections = changelogSections(changelog);
  problems.push(...sectionProblems(sections, version));
  const unreleased = sections.find((s) => s.name === "Unreleased");
  if (!parsed.prerelease.length && unreleased?.entries) problems.push(`CHANGELOG.md: "## [Unreleased]" still has ${unreleased.entries} line(s) of entries. The release commit moves them under "## [${version}]"; work for a later release is merged after the release commit.`);
  if (repository && repositorySlug(pkg.repository) !== repository) problems.push(`package.json: repository is ${repositorySlug(pkg.repository) ?? "not a GitHub repository"}, but this is ${repository}. npm refuses provenance from another repository.`);
  return problems;
}

/** Problems with the version of a commit that is not being released. `latestTag` is the latest release tag, if known. */
function checkPullRequest({ pkg, lock, changelog, latestTag }) {
  const problems = versionProblems(pkg, lock);
  if (problems.length) return problems;
  const sections = changelogSections(changelog);
  if (!sections.some((s) => s.name === "Unreleased")) problems.push(`CHANGELOG.md has no "## [Unreleased]" heading. New work is recorded there.`);
  if (sections.some((s) => s.name === pkg.version)) problems.push(...sectionProblems(sections, pkg.version));
  else if (latestTag !== `v${pkg.version}`) {
    problems.push(
      `package.json states version ${pkg.version}, which has no heading in CHANGELOG.md and is not the latest release (${latestTag ?? "no release tag found: fetch tags, or pass --latest-tag"}). ` +
        `To prepare a release, move the entries under "## [${pkg.version}] — <date>"; otherwise leave the version as it was and record the work under "## [Unreleased]".`,
    );
  }
  return problems;
}

/** The dist-tag a version is published under, given the version npm's `latest` points at now. */
function distTag(version, latest) {
  const parsed = parseVersion(version);
  if (parsed.prerelease.length) return "next";
  // A patch of an older line must not take `latest` away from the newest release.
  if (parseVersion(latest) && compareVersions(version, latest) < 0) return `release-${parsed.major}.${parsed.minor}`;
  return "latest";
}

function latestReleaseTag(root) {
  let out;
  try {
    out = execFileSync("git", ["tag", "--list", "v*"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
  const versions = out.split("\n").map((t) => t.trim().slice(1)).filter((v) => parseVersion(v) && !parseVersion(v).prerelease.length);
  return versions.length ? `v${versions.sort(compareVersions).at(-1)}` : undefined;
}

function main(argv, env) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pr") args.pr = true;
    else if (a === "--notes" || a === "--dist-tag" || a === "--root" || a === "--latest" || a === "--latest-tag") {
      if (argv[i + 1] === undefined) return usage(`${a} needs a value`);
      args[a.slice(2)] = argv[++i];
    } else if (a === "--help" || a === "-h") return usage();
    else if (a.startsWith("--")) return usage(`unknown option ${a}`);
    else args.positional.push(a);
  }
  if (args.positional.length > 1) return usage("one tag at a time");

  const root = resolve(args.root ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
  const read = (name) => readFileSync(join(root, name), "utf8");
  const pkg = JSON.parse(read("package.json"));
  const lock = existsSync(join(root, "package-lock.json")) ? JSON.parse(read("package-lock.json")) : undefined;
  const changelog = read("CHANGELOG.md");
  const fail = (problems) => {
    for (const p of problems) console.error(`check-release: ${p}`);
    return 1;
  };

  if (args.notes !== undefined) {
    const version = args.notes.replace(/^v/, "");
    const section = changelogSections(changelog).find((s) => s.name === version);
    if (!section?.text) return fail([`CHANGELOG.md has no section with entries for ${version}.`]);
    console.log(section.text);
    return 0;
  }

  if (args["dist-tag"] !== undefined) {
    const version = args["dist-tag"].replace(/^v/, "");
    if (!parseVersion(version)) return fail([`"${args["dist-tag"]}" is not a version.`]);
    console.log(distTag(version, args.latest));
    return 0;
  }

  const tag = args.pr ? undefined : args.positional[0] ?? (env.GITHUB_REF_TYPE === "tag" ? env.GITHUB_REF_NAME : undefined);
  if (tag !== undefined) {
    const problems = checkRelease({ tag, pkg, lock, changelog, repository: env.GITHUB_ACTIONS === "true" ? env.GITHUB_REPOSITORY : undefined });
    if (problems.length) return fail(problems);
    console.log(`check-release: ${tag} releases ${pkg.name} ${pkg.version} (dist-tag ${distTag(pkg.version, args.latest)}).`);
    return 0;
  }

  const latestTag = args["latest-tag"] ?? latestReleaseTag(root);
  const problems = checkPullRequest({ pkg, lock, changelog, latestTag });
  if (problems.length) return fail(problems);
  const unreleased = changelogSections(changelog).find((s) => s.name === "Unreleased")?.entries ?? 0;
  const state = latestTag === `v${pkg.version}` ? `released as ${latestTag}` : `not tagged yet (latest release tag: ${latestTag ?? "none found"})`;
  console.log(`check-release: ${pkg.name} ${pkg.version} is consistent: ${state}, ${unreleased} line(s) under Unreleased.`);
  return 0;
}

function usage(error) {
  if (error) console.error(`check-release: ${error}`);
  console.error("usage: check-release.mjs [<tag> | --pr | --notes <version> | --dist-tag <version> [--latest <version>]] [--root <dir>] [--latest-tag <tag>]");
  return error ? 2 : 0;
}

process.exitCode = main(process.argv.slice(2), process.env);

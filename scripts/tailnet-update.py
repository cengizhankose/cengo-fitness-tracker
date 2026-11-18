#!/usr/bin/env python3
"""Fetch main, build in isolation, atomically publish only successful builds."""
import fcntl, json, os, shutil, subprocess, tempfile
from pathlib import Path
HOME = Path.home()
ROOT = HOME / "Library/Application Support/CengoFitness"
SOURCE = HOME / "Projects/cengo-fitness-tracker"
ROOT.mkdir(parents=True, exist_ok=True)
os.environ["PATH"] = str(HOME/".bun/bin") + ":/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
os.environ["GIT_TERMINAL_PROMPT"] = "0"
lock = (ROOT / "update.lock").open("w")
try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError: raise SystemExit(0)
def run(*args, **kw):
    return subprocess.check_output(args, text=True, **kw).strip()
repo = ROOT / "source.git"
if not repo.exists(): run("git", "init", "--bare", str(repo))
git = ["git", "--git-dir=" + str(repo), "-c", "credential.helper=", "-c", "credential.helper=!/Users/logan/.local/bin/gh auth git-credential"]
run(*git, "fetch", "--depth=1", "https://github.com/cengizhankose/cengo-fitness-tracker.git", "main")
sha = run(*git, "rev-parse", "FETCH_HEAD")
current = ROOT / "current"
if current.exists() and (current / "deploy.json").exists():
    if json.loads((current / "deploy.json").read_text())["commit"] == sha:
        print("Already current:", sha); raise SystemExit(0)
with tempfile.TemporaryDirectory(prefix="build-", dir=ROOT) as tmp:
    work = Path(tmp)
    archive = work / "source.tar"
    subprocess.run(git + ["archive", "--format=tar", "--output=" + str(archive), sha], check=True)
    subprocess.run(["tar", "-xf", str(archive), "-C", str(work)], check=True)
    shutil.copy2(SOURCE / ".env.local", work / ".env.local")
    env = dict(os.environ, VITE_CONVEX_URL="https://logan-macbook-pro.tail15e824.ts.net:8445")
    subprocess.run([str(HOME/".bun/bin/bun"), "install", "--frozen-lockfile"], cwd=work, env=env, check=True)
    subprocess.run([str(HOME/".bun/bin/bun"), "run", "build"], cwd=work, env=env, check=True)
    dist = work / "dist"
    assert (dist / "index.html").is_file() and (dist / "sw.js").is_file()
    (dist / "deploy.json").write_text(json.dumps({"commit": sha}))
    release = ROOT / "releases" / sha
    release.parent.mkdir(exist_ok=True)
    if not release.exists(): shutil.copytree(dist, release)
    candidate = ROOT / "next"
    candidate.unlink(missing_ok=True)
    candidate.symlink_to(release, target_is_directory=True)
    candidate.replace(current)
    print("Published:", sha, flush=True)

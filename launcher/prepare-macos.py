#!/usr/bin/env python3
"""Prepare a private ARM64 NW.js copy; never modify the Steam installation."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile
from urllib.request import Request, urlopen


VERSION = "0.82.0"
ARCHIVE = f"nwjs-sdk-v{VERSION}-osx-arm64.zip"
RUNTIME_SHA256 = "d2f38741cd6065e255aab6f947a8a1d417e59b2d6419a03f7ac45ac863621803"
# Original game scripts whose path patch sites were reviewed.
SCRIPT_SHA256 = {
    "b5bf45f38e8165bbd5093702695486fe77797a27914bba8b1fdd5f46658396bc": "V1.0.9.1",
    "1e1643722efc032824881f03ce4d81df1135e6a8cd8e08d9fd87e56e480ac9f6": "V1.0.10.2",
    "3e0febeb8342138ed47d9e8499e3646f4e8ddc2ce89a9faa0bebbad9ba83280e": "V1.0.11.2",
    "e6a6d629bf7320344445ac7e6e47085211496e5b6a9498aec13ab1a121abd04b": "V1.0.12.2",
    "2546ca0823f858f3ce2a2e1dd013ed70f7e4d330e8d6c33d7ce75fb2a75d6936": "V1.0.13.0",
}
STEAM_COMMON = Path.home() / (
    "Library/Application Support/CrossOver/Bottles/NGO-Steam-0/drive_c/"
    "Program Files (x86)/Steam/steamapps/common"
)
SOURCE_CANDIDATES = (STEAM_COMMON / "塔防山贼模拟器", STEAM_COMMON / "bandit")
DEFAULT_SOURCE = next((p for p in SOURCE_CANDIDATES if (p / "package.nw").exists()), SOURCE_CANDIDATES[0])


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def patch_runtime(script):
    if hashlib.sha256(script).hexdigest() not in SCRIPT_SHA256:
        raise SystemExit("遊戲版本已變更：請重新核對路徑修正，尚未修改任何遊戲副本。")
    text = script.decode("utf-8")
    replacements = {
        'this._appFolder=this._path["dirname"](this._process["execPath"])+this._slash':
            'this._appFolder=this._process["cwd"]()+this._slash',
        'this._nwjsAppFolder=this._nwjsPath["dirname"](process["execPath"])+"\\\\"':
            'this._nwjsAppFolder=process["cwd"]()+"/"',
        '"savedir\\\\': '"savedir/',
        '"backup\\\\': '"backup/',
    }
    counts = {}
    for before, after in replacements.items():
        count = text.count(before)
        if count == 0 or (before.startswith("this.") and count != 1):
            raise SystemExit(f"無法確認路徑修正位置：{before}")
        counts[before] = count
        text = text.replace(before, after)
    return text.encode("utf-8"), counts


def verify_runtime(source, game):
    """Confirm a prepared copy differs from the original only by the reviewed path patches."""
    with zipfile.ZipFile(source / "package.nw") as package:
        original = package.read("scripts/c3runtime.js")
    patched, counts = patch_runtime(original)
    if (game / "scripts/c3runtime.js").read_bytes() != patched:
        raise SystemExit("副本的 runtime 與已核對的路徑修正結果不同。")
    print(json.dumps({
        "game_version": SCRIPT_SHA256[hashlib.sha256(original).hexdigest()],
        "original_c3runtime_sha256": hashlib.sha256(original).hexdigest(),
        "patched_c3runtime_sha256": hashlib.sha256(patched).hexdigest(),
        "path_replacements": counts,
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=Path.home() / "bandit-mac-port")
    parser.add_argument("--runtime-archive", type=Path, help="Reuse an official downloaded archive")
    parser.add_argument("--verify-runtime", type=Path, metavar="GAME_DIR",
                        help="Only check a prepared game directory against --source; writes nothing")
    args = parser.parse_args()
    if args.verify_runtime:
        return verify_runtime(args.source.expanduser().resolve(), args.verify_runtime.expanduser().resolve())
    source, output = args.source.expanduser().resolve(), args.output.expanduser().resolve()
    if output == source or source in output.parents or output in source.parents:
        raise SystemExit("輸出必須與 Steam 遊戲目錄分開。")

    with zipfile.ZipFile(source / "package.nw") as package:
        original = package.read("scripts/c3runtime.js")
        patched, counts = patch_runtime(original)
        for info in package.infolist():
            target = output / "game" / info.filename
            if not target.resolve().is_relative_to(output / "game"):
                raise SystemExit("遊戲封裝含不安全的相對路徑。")

    output.mkdir(parents=True, exist_ok=True)
    downloads = output / "downloads"
    downloads.mkdir(exist_ok=True)
    archive = args.runtime_archive.expanduser().resolve() if args.runtime_archive else downloads / ARCHIVE
    if not archive.exists():
        print(f"下載官方 NW.js {VERSION} ARM64…", flush=True)
        partial = archive.with_suffix(".partial")
        # The NW.js CDN rejects Python's default User-Agent.
        request = Request(f"https://dl.nwjs.io/v{VERSION}/{ARCHIVE}", headers={"User-Agent": "bandit-save-editor-prepare"})
        with urlopen(request, timeout=60) as response:
            with partial.open("wb") as stream:
                shutil.copyfileobj(response, stream)
        if digest(partial) != RUNTIME_SHA256:
            partial.unlink()
            raise SystemExit("NW.js 下載校驗失敗。")
        partial.replace(archive)
    if digest(archive) != RUNTIME_SHA256:
        raise SystemExit("NW.js archive SHA-256 不符，停止準備。")
    runtime = output / "runtime" / f"nwjs-sdk-v{VERSION}-osx-arm64"
    if not (runtime / "nwjs.app/Contents/MacOS/nwjs").exists():
        subprocess.run(["ditto", "-x", "-k", str(archive), str(output / "runtime")], check=True)

    game = output / "game"
    with zipfile.ZipFile(source / "package.nw") as package:
        package.extractall(game)
    (game / "scripts/c3runtime.js").write_bytes(patched)
    manifest = json.loads((game / "package.json").read_text())
    for icon in manifest.get("c3-app-icons", []):
        icon["src"] = icon["src"].replace("\\", "/")
    (game / "package.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    for name in ("icons", "dlc"):
        if (source / name).exists():
            shutil.copytree(source / name, game / name, dirs_exist_ok=True)
    # Import only once. Rebuilding must never replace Mac progress with older saves.
    for name in ("savedir", "record.dat"):
        if (source / name).exists() and not (game / name).exists():
            if (source / name).is_dir():
                shutil.copytree(source / name, game / name)
            else:
                shutil.copy2(source / name, game / name)
    (game / "backup").mkdir(exist_ok=True)
    (output / "logs").mkdir(exist_ok=True)
    command = output / "啟動山賊.command"
    command.write_text(
        '#!/bin/zsh\nset -euo pipefail\n'
        'ROOT="${0:A:h}"\ncd "$ROOT/game"\n'
        'exec "$ROOT/runtime/nwjs-sdk-v0.82.0-osx-arm64/nwjs.app/Contents/MacOS/nwjs" '
        '"$ROOT/game" --user-data-dir="$ROOT/profile" --enable-logging=stderr '
        '>>"$ROOT/logs/game.log" 2>&1\n'
    )
    command.chmod(0o755)
    (output / "build-info.json").write_text(json.dumps({
        "nwjs": VERSION, "architecture": "arm64", "runtime_sha256": RUNTIME_SHA256,
        "game_version": SCRIPT_SHA256[hashlib.sha256(original).hexdigest()],
        "original_c3runtime_sha256": hashlib.sha256(original).hexdigest(), "path_replacements": counts,
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"啟動器：{command}\n獨立存檔：{game / 'savedir'}\nLog：{output / 'logs/game.log'}")


if __name__ == "__main__":
    main()

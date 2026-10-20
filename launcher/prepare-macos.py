#!/usr/bin/env python3
"""Prepare a private ARM64 NW.js copy; never modify the Steam installation."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile
from urllib.request import urlopen


VERSION = "0.82.0"
ARCHIVE = f"nwjs-sdk-v{VERSION}-osx-arm64.zip"
RUNTIME_SHA256 = "d2f38741cd6065e255aab6f947a8a1d417e59b2d6419a03f7ac45ac863621803"
SCRIPT_SHA256 = "b5bf45f38e8165bbd5093702695486fe77797a27914bba8b1fdd5f46658396bc"
DEFAULT_SOURCE = Path.home() / (
    "Library/Application Support/CrossOver/Bottles/NGO-Steam-0/drive_c/"
    "Program Files (x86)/Steam/steamapps/common/bandit"
)


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def patch_runtime(script):
    if hashlib.sha256(script).hexdigest() != SCRIPT_SHA256:
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=Path.home() / "bandit-mac-port")
    parser.add_argument("--runtime-archive", type=Path, help="Reuse an official downloaded archive")
    args = parser.parse_args()
    source, output = args.source.expanduser().resolve(), args.output.expanduser().resolve()
    if output == source or source in output.parents or output in source.parents:
        raise SystemExit("輸出必須與 Steam 遊戲目錄分開。")

    with zipfile.ZipFile(source / "package.nw") as package:
        patched, counts = patch_runtime(package.read("scripts/c3runtime.js"))
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
        with urlopen(f"https://dl.nwjs.io/v{VERSION}/{ARCHIVE}", timeout=60) as response:
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
        "original_c3runtime_sha256": SCRIPT_SHA256, "path_replacements": counts,
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"啟動器：{command}\n獨立存檔：{game / 'savedir'}\nLog：{output / 'logs/game.log'}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
bundle_python.py  —  build the relocatable Python runtime that ships inside the packaged Electron app.

Usage (from this backend folder):
    python scripts/bundle_python.py                 # -> build/python
    python scripts/bundle_python.py --python 3.12 --out build/python

What it makes: a copy of a standalone CPython (the python-build-standalone distribution that `uv` downloads, so the
user needs no Python installed) with this backend's requirements (requirements.txt, including the vendored
ab-manifesto / ab-desktop wheels) installed into it, pruned of what a running app never uses (tests, Tk, headers),
and with its bytecode precompiled (the sidecar then starts in well under a second). `npm run package` in the
frontend folder then copies `build/python` and the backend's own source next to the app (see electron-builder.yml).

Requires `uv` on the PATH and network access to download the standalone Python (cached by uv afterwards).
Verified on Windows x64; the Linux and macOS layouts are handled but not yet tested.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
IS_WIN = sys.platform == 'win32'

# Not needed to run an installed application. (Tk is the only part of the standard library with its own DLLs and data.)
PRUNE_WINDOWS = ['tcl', 'include', 'libs', 'Scripts', 'Lib/test', 'Lib/idlelib', 'Lib/tkinter', 'Lib/turtledemo',
                 'Lib/ensurepip', 'DLLs/_tkinter.pyd', 'DLLs/tcl86t.dll', 'DLLs/tk86t.dll']
PRUNE_UNIX = ['include', 'share', 'lib/tcl8.6', 'lib/tk8.6', 'lib/itcl4.2.4', 'lib/thread2.8.9']


def run(cmd: list[str], **kwargs) -> None:
    print('$', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kwargs)


def interpreter(root: Path) -> Path:
    return root / 'python.exe' if IS_WIN else root / 'bin' / 'python3'


def standalone_python(version: str, scratch: Path) -> Path:
    """Download (uv, into a scratch folder so the user's own uv-managed Pythons are untouched) and return the install folder."""
    env = {**os.environ, 'UV_PYTHON_INSTALL_DIR': str(scratch)}
    run(['uv', 'python', 'install', version], env=env)
    candidates = sorted(p for p in scratch.iterdir() if p.is_dir() and not p.is_symlink() and p.name.startswith(f'cpython-{version}.'))
    if not candidates:
        sys.exit(f'uv did not install a standalone Python {version} under {scratch}')
    return candidates[-1]


def folder_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob('*') if f.is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--python', default='3.12', help='Python version to bundle (default 3.12; the project needs >= 3.12)')
    parser.add_argument('--out', default='build/python', help='output folder, relative to the backend (default build/python)')
    args = parser.parse_args()
    if not shutil.which('uv'):
        sys.exit('uv is required (https://docs.astral.sh/uv/) to fetch the standalone Python')

    out = (BACKEND / args.out).resolve()
    if BACKEND not in out.parents:
        sys.exit('--out must be inside the backend folder')
    if out.exists():
        shutil.rmtree(out)
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='ab-python-') as scratch:
        source = standalone_python(args.python, Path(scratch))
        shutil.copytree(source, out, symlinks=True)

    python = interpreter(out)
    run(['uv', 'pip', 'install', '--python', python, '--break-system-packages', '-r', 'requirements.txt'], cwd=BACKEND)

    for rel in PRUNE_WINDOWS if IS_WIN else PRUNE_UNIX:
        target = out / rel
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink()
    for cache in out.rglob('__pycache__'):
        shutil.rmtree(cache, ignore_errors=True)

    # -s: ignore the user's own site-packages, exactly as the app does when it runs the sidecar.
    run([python, '-s', '-m', 'compileall', '-q', '-j', '0', out / ('Lib' if IS_WIN else 'lib')])
    run([python, '-s', '-c', 'import ab_desktop.sidecar, ab_manifesto, fastapi, uvicorn, pydantic'])

    size = folder_size(out)
    (out / 'BUNDLE.json').write_text(json.dumps({'python': args.python, 'bytes': size}, indent=2) + '\n', encoding='utf-8')
    print(f'\nbundled Python {args.python} -> {out}  ({size / 1_000_000:.0f} MB)')


if __name__ == '__main__':
    main()

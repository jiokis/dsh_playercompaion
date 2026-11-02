"""Command line entry: serve | selftest | warmup | capture."""

from __future__ import annotations

import json
import sys

from . import protocol
from .windows import set_dpi_awareness


def _print(value, pretty: bool = True) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.stdout.write(json.dumps(value, ensure_ascii=False, indent=2 if pretty else None) + "\n")
    sys.stdout.flush()


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    set_dpi_awareness()
    command = argv[0] if argv else "serve"
    if command == "serve":
        return protocol.serve()
    if command == "warmup":
        response = protocol.handle({"id": 1, "method": "warmup"})
        _print(response.get("result") or response)
        return 0 if response.get("ok") else 1
    if command == "selftest":
        params = {"warmup": "--no-warmup" not in argv}
        _print(protocol.selftest(params))
        return 0
    if command == "capture":
        params = {}
        index = 1
        while index < len(argv):
            token = argv[index]
            if token == "--game" and index + 1 < len(argv):
                params["game"] = argv[index + 1]
                index += 2
                continue
            if token == "--window" and index + 1 < len(argv):
                params["window"] = argv[index + 1]
                index += 2
                continue
            if token == "--mode" and index + 1 < len(argv):
                params["mode"] = argv[index + 1]
                index += 2
                continue
            if token == "--image":
                params["include_image"] = True
                index += 1
                continue
            index += 1
        response = protocol.handle({"id": 1, "method": "capture", "params": params})
        _print(response)
        return 0 if response.get("ok") else 1
    sys.stderr.write("usage: python -m lore_engine [serve|selftest|warmup|capture] [--no-warmup] [--game G] [--window W] [--mode dialogue|read] [--image]\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

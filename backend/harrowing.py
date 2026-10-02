"""The Harrowing: a GM Tools chat to a user-supplied local model.

No model ships with the app. The GM runs an OpenAI-compatible inference server
themselves (Ollama, LM Studio, llama.cpp, vLLM — anything speaking
/v1/chat/completions) and stores only an endpoint URL and model name. The
backend proxies chat completions to that endpoint over plain HTTP using httpx
(a declared runtime dependency — see requirements.txt). Optional reference
grounding injects hits from
the campaign's indexed rulebook library into the system prompt; user-supplied
PDFs are never shipped, only read at runtime.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

__all__ = ["HarrowingClient", "harrowing_settings_path"]


def _server_root(base_url: str) -> str:
    """Scheme://host[:port] of an endpoint URL, dropping any path (e.g. /v1).

    Ollama's native control endpoints (/api/ps, /api/generate) live at the
    server root, not under the OpenAI-compatible /v1 path the config stores.
    """
    parsed = urlparse(base_url)
    return f"{parsed.scheme}://{parsed.netloc}"

_DEFAULT_BASE_URL = "http://localhost:11434/v1"  # Ollama's OpenAI endpoint
_DEFAULT_MODEL = ""
_SETTINGS_ENV = "GM_WORKBENCH_HARROWING_SETTINGS"


def harrowing_settings_path() -> Path:
    """Where the endpoint configuration is persisted.

    In the packaged app Electron sets GM_WORKBENCH_DATA_DIR to the per-user
    data directory; in development it falls back to the repo's gitignored
    artifacts/local tree. An explicit env override wins, mirroring the other
    user-configured paths.
    """
    override = os.environ.get(_SETTINGS_ENV)
    if override:
        return Path(override)
    data_dir = os.environ.get("GM_WORKBENCH_DATA_DIR")
    base = (
        Path(data_dir)
        if data_dir
        else Path(__file__).resolve().parent.parent / "artifacts" / "local" / "data"
    )
    return base / "harrowing-settings.json"


class HarrowingClient:
    """Thin proxy to a user-supplied OpenAI-compatible chat-completions server."""

    def __init__(self, settings_path: Optional[Path] = None):
        self._settings_path = Path(settings_path) if settings_path else harrowing_settings_path()

    # ---------------- configuration ----------------

    def get_config(self) -> Dict[str, Any]:
        """Current endpoint config, falling back to defaults when unset."""
        try:
            raw = json.loads(self._settings_path.read_text(encoding="utf-8"))
            return {
                "base_url": raw.get("base_url") or _DEFAULT_BASE_URL,
                "model": raw.get("model") or _DEFAULT_MODEL,
            }
        except Exception:
            # Missing or unreadable settings are expected on first launch.
            return {"base_url": _DEFAULT_BASE_URL, "model": _DEFAULT_MODEL}

    def save_config(self, base_url: str, model: str) -> Dict[str, Any]:
        """Persist the endpoint URL and model name; returns the saved config."""
        base_url = (base_url or "").strip().rstrip("/")
        model = (model or "").strip()
        if not base_url:
            raise ValueError("base_url is required")
        if not model:
            raise ValueError("model is required")
        if not base_url.startswith(("http://", "https://")):
            raise ValueError("base_url must start with http:// or https://")
        self._settings_path.parent.mkdir(parents=True, exist_ok=True)
        self._settings_path.write_text(
            json.dumps({"base_url": base_url, "model": model}, indent=2),
            encoding="utf-8",
        )
        return {"base_url": base_url, "model": model}

    # ---------------- probing ----------------

    def status(self) -> Dict[str, Any]:
        """Report config plus whether the endpoint is reachable and the model present."""
        config = self.get_config()
        result: Dict[str, Any] = {
            "configured": bool(config["model"]),
            "available": False,
            "models": [],
            "error": None,
            **config,
        }
        try:
            with httpx.Client(base_url=config["base_url"], timeout=4.0) as client:
                response = client.get("/models")
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            result["error"] = str(exc)
            return result
        models = [entry.get("id", "") for entry in payload.get("data", [])]
        result["models"] = models
        result["available"] = True
        if config["model"] and models:
            result["model_present"] = config["model"] in models
        result["loaded"] = self._loaded_models(config)
        return result

    def _loaded_models(self, config: Dict[str, Any]) -> bool:
        """True when the configured model is currently resident in memory.

        Uses Ollama's /api/ps (the process list). On a non-Ollama server this
        endpoint may not exist; report False and let chat warm it on demand.
        """
        try:
            # /api/ps sits at the server root, not under the OpenAI /v1 path.
            response = httpx.get(f"{_server_root(config['base_url'])}/api/ps", timeout=4.0)
            if response.status_code != 200:
                return False
            payload = response.json()
        except Exception:
            return False
        return any(m.get("name") == config["model"] for m in payload.get("models", []))

    def unload(self) -> Dict[str, Any]:
        """Unload the configured model from memory (keep_alive=0).

        Lets the app dump the resident model the moment the GM is done, so a
        large model never idles in RAM next to the rest of the desktop.
        """
        config = self.get_config()
        if not config["model"]:
            return {"unloaded": False, "error": "No model configured"}
        try:
            httpx.post(
                f"{_server_root(config['base_url'])}/api/generate",
                json={"model": config["model"], "keep_alive": 0},
                timeout=10.0,
            )
        except Exception as exc:
            return {"unloaded": False, "error": str(exc)}
        return {"unloaded": True, "loaded": self._loaded_models(config)}

    # ---------------- chat ----------------

    def chat(
        self,
        messages: List[Dict[str, str]],
        reference_snippets: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 512,
        temperature: float = 0.8,
    ) -> Dict[str, Any]:
        """Send a chat-completion request; return {content, usage} or raise.

        `reference_snippets` (already-retrieved index hits) are folded into a
        grounding block inside the system message so the model answers from the
        GM's own books rather than general knowledge.
        """
        config = self.get_config()
        if not config["model"]:
            raise RuntimeError("No model configured — open Harrowing settings first")

        system_parts = [
            "You are The Harrowing, a creative assistant for a tabletop "
            "Pathfinder Game Master. Invent vivid, concise story beats, "
            "background, NPC color, and plot hooks. Ground answers in the "
            "campaign's rules and setting material when supplied; say plainly "
            "when you do not know a rule rather than inventing one."
        ]
        if reference_snippets:
            passages = []
            for hit in reference_snippets:
                title = hit.get("title") or hit.get("filename") or "reference"
                page = hit.get("page_number")
                where = f" (p. {page})" if page else ""
                passages.append(f"[{title}{where}]\n{hit.get('excerpt', '').strip()}")
            system_parts.append(
                "Relevant passages from the GM's own rulebooks:\n\n" + "\n\n".join(passages)
            )
        wire_messages = [{"role": "system", "content": "\n\n".join(system_parts)}]
        wire_messages.extend(messages)

        body = {
            "model": config["model"],
            "messages": wire_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        try:
            with httpx.Client(base_url=config["base_url"], timeout=120.0) as client:
                response = client.post("/chat/completions", json=body)
        except httpx.ConnectError:
            raise RuntimeError(
                f"The Harrowing endpoint at {config['base_url']} is not running. "
                "Start your local model server (e.g. `ollama serve`) and try again."
            )
        except Exception as exc:
            raise RuntimeError(f"Could not reach the Harrowing endpoint: {exc}")
        if response.status_code != 200:
            detail = response.text[:200].strip()
            raise RuntimeError(f"Model server returned {response.status_code}: {detail}")
        payload = response.json()
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            raise RuntimeError("Model server returned an unexpected response shape")
        return {"content": content, "usage": payload.get("usage", {})}

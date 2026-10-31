# AGENTS.md

## Project purpose

Teaching lab for **Agent Harness** concepts with local **pi + Ollama / Qwen**: tool loop, hard gates, path sandbox, traces, and evals. Primary audience: PMs learning what to demand from harness engineering, plus engineers implementing those gates.

## Safety rules

- Run harness / Node / npm / tests / trace analysis on Linux or WSL; keep the model server (e.g. Ollama) on the host if that is your sample setup.
- Default to read-only tools unless the current lab explicitly allows writes.
- Stay inside the project `workspaceRoot` / `<repo-root>`. Do not read or write outside it.
- Never read or display API keys, tokens, cookies, SSH keys, browser profiles, or other credentials.
- Do not delete, install globally, publish, change system config, or kill processes unless the user explicitly confirms.
- On tool failure, report the real error; never invent results.
- Change one experimental variable at a time; keep reproducible commands and outputs.

## Verification

- Claims need real tool output, tests, or traces.
- After code changes, run the smallest relevant test (`npm test`, targeted eval).
- Agent runs should record model, prompt, tool list, context notes, duration, errors, and `stop_reason`.

## Public curriculum

- Prefer content that can be open-sourced: no private product brands, no personal absolute home paths, no private emails.
- Diagrams: bilingual **CN + EN** labels.
- See root `README.md` and `OPEN_SOURCE.md`.

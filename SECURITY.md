# Security policy

Jarvis reads AI credentials from your machine and runs a local agent that can take screenshots, read windows and files, and, if you turn them on, click and type in other apps, write files and run commands. Security reports are taken seriously.

Default data lives under `~/.kineto-roamies` (or `ROAMIES_DATA_DIR`).

## Supported versions

Only the latest release of this repo gets security fixes: [KennethAduan/local-jarvis releases](https://github.com/KennethAduan/local-jarvis/releases/latest).

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through [GitHub security advisories](https://github.com/KennethAduan/local-jarvis/security/advisories/new).

Include:

- what an attacker can do, and what they need first
- steps to reproduce, or a proof of concept
- affected version and OS

You'll get an acknowledgement within 7 days. Once a fix ships, the advisory will be published with credit to you unless you'd rather stay anonymous.

## In scope

- the agent sidecar and its tools: file access, commands, screenshots, app control, browser tools
- the safety switches for writing files and running commands
- the Tauri shell and its commands
- native helpers (voice, hands, Kokoro)
- memory and session files under the Jarvis data root

## Out of scope

- an AI model choosing to do something you asked for or that your settings allow
- attacks that need an already-compromised user account or machine
- issues that only affect the original Roamies project and not Jarvis

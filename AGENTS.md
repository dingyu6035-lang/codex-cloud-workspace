# Instructions for Codex

- Before editing, inspect the relevant project directory and follow its existing README and conventions.
- Keep independent projects in separate top-level directories unless the user asks otherwise.
- Do not commit secrets, credentials, private user data, or machine-specific configuration.
- Avoid adding large generated files or build outputs; use an appropriate `.gitignore`.
- Do not assume a hosting provider, deployment target, or required secrets. Ask or inspect project-specific configuration before adding deployment workflows.
- Run the project's documented checks before reporting completion, when the required tools are available.

## DY collaboration convention

- `DY/` is this user's workspace. Put their new projects, submitted files, documentation, and handoff records under `DY/` by default, with independent projects in separate subdirectories.
- Read `DY/README.md` and `DY/HANDOFF.md` before working on this user's tasks. Keep the handoff record current when work changes.
- Preserve collaborators' directories and changes. Changes outside `DY/` that affect shared behavior must be explicitly scoped and documented in the handoff.
- Use a separate `dy/<task>` branch for each task when making implementation changes; do not mix unrelated work or overwrite collaborators' branches. Check the current branch and working tree first and preserve existing changes.
- Keep commits focused on one task. Never force-push, reset, or discard someone else's work to resolve conflicts. Do not commit or push unless requested.
- A directory convention does not enforce access permissions. Do not claim that `DY/` provides security or GitHub permission isolation.

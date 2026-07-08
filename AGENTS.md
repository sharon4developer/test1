# AGENTS.md

## Cursor Cloud specific instructions

This repository is a minimal sandbox repo. It has no build system, package
manager, tests, or lint config. The only runnable code is the PHP script
`sharonTest.php` (a couple of `echo` statements).

### Running the "application"

- **Language/runtime:** PHP (CLI). Installed via `php-cli` (`php` 8.3.x). There is
  no `composer.json` or framework.
- **Run once (CLI):** `php sharonTest.php` — prints `test echo filetest echo file 2 `.
- **Run as a web app (dev server):** `php -S 0.0.0.0:8080 -t .` from the repo root,
  then open `http://localhost:8080/sharonTest.php`. The built-in server executes
  the PHP and renders its output.

### Gotchas

- PHP's built-in dev server has **no automatic directory listing**; hitting
  `http://localhost:8080/` returns a 404 unless an `index.php` exists. Navigate
  directly to `sharonTest.php`.
- There are no automated tests, lint, or build steps to run.

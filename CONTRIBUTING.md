# Contributing

Thanks for your interest! This library is fairly mature and focused, so contributions are generally:

- **Bug fixes** (especially determinism issues)
- **Performance improvements** (as long as they preserve determinism)
- **Documentation improvements**
- **New fixed-point operations** (if they fit the scope)

For major features or API changes, please open an issue first to discuss.

## Quick Start

1. Fork the repository.
2. Create a feature branch.
3. Add tests for any changes.
4. Ensure tests pass.
5. Open a pull request with a clear description.

## Development

- Install dependencies: `npm install`
- Run tests: `npm test`
- Run coverage: `npm run test:coverage`

## Style

- **Determinism first**: Never introduce floating-point math in runtime paths
- **No side effects**: All operations must be pure functions
- **API stability**: Breaking changes require a major version bump and strong justification
- **Test coverage**: Every public function needs tests demonstrating deterministic behavior

## Pull Requests

- Describe the problem and solution.
- Include tests for new behavior.
- Keep changes focused and minimal.

## Review Process

- I'll review PRs as time allows (usually within a week)
- I may request changes or suggest alternatives
- Once approved, I'll merge and include your changes in the next release
- All contributors are credited in the release notes

## Before You Start

- Check existing issues to avoid duplicates
- For bugs, include a minimal reproduction case
- For features, describe the use case and why it belongs in this library

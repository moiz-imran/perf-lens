# Contributing to PerfLens

First off, thank you for considering contributing to PerfLens! It's people like you that make PerfLens such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). The template will ask you to include:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if relevant
* Include your environment details:
  - Node.js version
  - npm/yarn/pnpm version
  - Operating system
  - Project configuration

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Please use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) when suggesting enhancements. The template will guide you to include:

* A clear and descriptive title
* A detailed description of the proposed functionality
* Explain why this enhancement would be useful
* List any alternative solutions or features you've considered
* Include screenshots or mockups if relevant

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Fill out the [pull request template](.github/pull_request_template.md)
7. Wait for the CI checks to pass

Our [continuous integration workflow](.github/workflows/ci.yml) will automatically:
- Run tests on multiple Node.js versions
- Check code formatting and linting
- Verify type checking
- Run the build process
- Check for security vulnerabilities

### Development Setup

1. Clone your fork of the repo
   ```bash
   git clone https://github.com/YOUR_USERNAME/perf-lens.git
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a branch
   ```bash
   git checkout -b my-feature
   ```

4. Make your changes and test them
   ```bash
   npm run test
   npm run lint
   ```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages to enable automated versioning:

* `feat:` for new features (minor version bump)
* `fix:` for bug fixes (patch version bump)
* `BREAKING CHANGE:` in the commit body for breaking changes (major version bump)
* `docs:` for documentation changes
* `style:` for code style changes (formatting, etc)
* `refactor:` for code refactoring
* `test:` for adding tests
* `chore:` for updating build tasks, package manager configs, etc

Examples:
```
feat: add support for Vue.js analysis
fix: resolve issue with large file scanning
docs: update configuration examples

BREAKING CHANGE: Changed the configuration format to use camelCase
```

### Release Process

This project uses semantic-release for automated versioning. The version is determined by your commit messages:

1. `feat:` commits trigger a minor version bump (1.0.0 → 1.1.0)
2. `fix:` commits trigger a patch version bump (1.0.0 → 1.0.1)
3. Commits with `BREAKING CHANGE:` trigger a major version bump (1.0.0 → 2.0.0)

The release process is automated through GitHub Actions and will:
- Generate a new version number
- Update the CHANGELOG.md
- Create a GitHub release
- Publish to npm
- Tag the release in git

### Testing

* Write test cases for any new functionality
* Ensure all tests pass before submitting PR
* Include both unit and integration tests where appropriate
* Run tests using:
  ```bash
  npm test
  ```

### Documentation

* Update the README.md if you change functionality
* Update API documentation for any modified functions
* Add JSDoc comments for new functions
* Update the configuration reference for new options

### Style Guide

* TypeScript for all new code
* Use ESLint and Prettier for code formatting
* Follow existing code style and patterns
* Add appropriate comments for complex logic
* Use meaningful variable and function names

### Working with Issues

* Feel free to ask for help or clarification
* Link PRs to relevant issues
* Use issue templates when provided
* Tag maintainers if you need assistance

## Project Structure

```
.github/                     # GitHub specific configuration
├── ISSUE_TEMPLATE/          # Issue templates
│   ├── bug_report.yml       # Bug report template
│   └── feature_request.yml  # Feature request template
├── workflows/               # GitHub Actions workflows
│   └── ci.yml               # CI pipeline configuration
└── pull_request_template.md # PR template

src/                         # Source code
├── ai/                      # AI integration modules
├── cli/                     # Command line interface
├── types/                   # TypeScript type definitions
└── utils/                   # Utility functions
```

## Getting Help

* Create an issue with the "question" label
* Contact the author directly at moizwasti@gmail.com for:
  - Technical questions
  - Commercial inquiries
  - Other support needs

## Recognition

Contributors are recognized in:
* The project README
* Release notes
* Our documentation

Thank you for contributing to PerfLens! 🎉
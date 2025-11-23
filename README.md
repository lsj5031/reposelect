# reposelect v2 — Agent-Only Context

**No fallbacks. No grep. Only intelligence.**

`reposelect` is an intelligent CLI tool that uses LLM agents to select the most relevant files from your repository based on a natural language question, then packs them into a single AI-friendly file using Repomix.

## Why?

Instead of dumping your entire repository into an AI context (wasting tokens and overwhelming the model), `reposelect`:

- **Refuses to guess**: Uses only real LLM agents for file selection—no naive scoring fallback
- **Respects budgets**: Stays within token limits while maintaining context quality  
- **Works anywhere**: CLI-only, no GUI required
- **Leverages existing tools**: Uses Repomix for output packing

## Installation

```bash
# Install Repomix (required for packing)
npm install -g repomix

# Clone and install reposelect
git clone <repo-url>
cd reposelect
npm install
npm run build
npm link
```

## Usage

```bash
# Auto-pick best available agent (factory → opencode)
reposelect "How does authentication work?" --smart

# Specify an agent
reposelect "How does authentication work?" --agent factory
reposelect "How does authentication work?" --agent opencode

# With custom token budget
reposelect "Database connection logic" --repo ./my-app --out db-context.xml --budget 8000

# Preview what agent selected (dry run)
reposelect "Error handling patterns" --dry-run --top 20

# Different output format
reposelect "API endpoints" --format markdown --out api.md
```

## Options

- `question` - Your question about the codebase (required)
- `--repo, -r` - Repository path (default: current directory)
- `--out, -o` - Output file (default: `context.xml`)
- `--budget, -b` - Token budget limit (default: 12000)
- `--verbose, -v` - Verbose output
- `--agent` - Force specific agent: `factory` or `opencode`
- `--smart` - Auto-pick best available agent (tries factory first, then opencode)
- `--dry-run` - Preview file selection without packing
- `--top N` - Show top N files in dry-run (default: 20)
- `--format, -f` - Output format: `xml`, `markdown`, or `json` (default: `xml`)
- `--help, -h` - Show help

## How it works

1. **Agent Selection**: Choose between Factory Droid or OpenCode (or let `--smart` pick)
2. **Semantic Analysis**: LLM analyzes repository structure and your question
3. **Intelligent Selection**: Files chosen based on semantic relationships, not keywords
4. **Reasoning**: Agent provides explanations for selections
5. **Packing**: Selected files are packed using Repomix in your chosen format

If both agents fail or are unavailable, `reposelect` exits with a clear error message and installation instructions.

## Output

The output file contains:

- File summary and directory tree
- Selected file contents with syntax highlighting
- Instruction template for AI context
- Token count and metadata

## Examples

```bash
# Authentication analysis with auto-selection
reposelect "How does authentication work?" --smart --out auth-context.xml

# Database investigation with specific agent
reposelect "Database models and migrations" --agent factory --budget 15000 --verbose

# API endpoint analysis with markdown output
reposelect "REST API endpoints for user management" --format markdown

# Preview before packing
reposelect "Microservice communication" --dry-run --top 10
```

## Requirements

- Node.js 16+
- Git repository
- Repomix (`npm install -g repomix`)

### LLM Agents (at least one required)

- **Factory Droid**: Install with `curl -fsSL https://app.factory.ai/cli | sh` and set `FACTORY_API_KEY`
- **OpenCode**: Install from https://opencode.ai and authenticate with `opencode auth login`

## Philosophy

`reposelect v2` refuses to be a low-signal tool. If no agent can analyze your codebase:

- It won't fall back to naive keyword matching
- It won't guess based on filenames
- It will fail loudly with helpful error messages

This ensures the context you get is **always high-quality and semantically sound**.

It's like how `eslint --fix` refuses to run without a config—intentional design, not a limitation.

## Similar Tools

- [RepoPrompt](https://repoprompt.com) - Full-featured GUI + MCP server
- [Repomix](https://github.com/yamadashy/repomix) - Repository packing tool

## License

MIT

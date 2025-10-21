# reposelect

**RepoPrompt-Lite**: Smart file selection and packing for AI context

`reposelect` is a minimal CLI tool that intelligently selects the most relevant files from your repository based on a natural language question, then packs them into a single AI-friendly file using Repomix.

## Why?

Instead of dumping your entire repository into an AI context (wasting tokens and overwhelming the model), `reposelect`:

- **Selects precisely**: Uses heuristics to find files relevant to your question
- **Respects budgets**: Stays within token limits while maintaining context quality  
- **Works anywhere**: CLI-only, no GUI required
- **Leverages existing tools**: Uses Git for file discovery and Repomix for packing

## Installation

```bash
# Install dependencies
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
# Basic usage
reposelect "How is JWT validation implemented?" --repo . --out context.xml

# With custom token budget
reposelect "Database connection logic" --repo ./my-app --out db-context.xml --budget 8000

# Verbose output
reposelect "Error handling patterns" --verbose
```

## Options

- `question` - Your question about the codebase (required)
- `--repo, -r` - Repository path (default: current directory)
- `--out, -o` - Output file (default: `context.xml`)
- `--budget, -b` - Token budget limit (default: 12000)
- `--verbose, -v` - Verbose output
- `--help, -h` - Show help

## How it works

1. **Keyword extraction**: Pulls meaningful terms from your question
2. **File discovery**: Uses `git ls-files` and `git grep` to find candidates
3. **Scoring algorithm**: Ranks files by:
   - Filename keyword matches (3x weight)
   - Content keyword matches (2x weight) 
   - Recency of changes
   - File type relevance
   - Size penalties
4. **Selection**: Picks top files within token budget
5. **Packing**: Pipes selected files to Repomix for final XML/MD output

## File Selection Heuristics

`reposelect` prioritizes files that:

- Match keywords in their filename or path
- Contain keywords in their content
- Were recently modified
- Are relevant file types (.ts, .js, .py, .md, .json, etc.)
- Are part of essential project files (README, package.json, configs)

Always includes:
- README files
- Package/dependency files
- Configuration files
- Documentation

## Output

The output file contains:

- File summary and directory tree
- Selected file contents with syntax highlighting
- Instruction template for AI context
- Token count and metadata

## Examples

```bash
# Find authentication-related files
reposelect "How does authentication work?" --out auth-context.xml

# Investigate database schema
reposelect "Database models and migrations" --budget 15000 --verbose

# API endpoint analysis  
reposelect "REST API endpoints for user management" --repo ./backend
```

## Requirements

- Node.js 16+
- Git repository
- Repomix (`npm install -g repomix`)

## Similar Tools

- [RepoPrompt](https://repoprompt.com) - Full-featured GUI + MCP server
- [Repomix](https://github.com/yamadashy/repomix) - Repository packing tool

## License

MIT
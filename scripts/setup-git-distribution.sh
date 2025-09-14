#!/bin/bash

# LCAgents Git Repository Setup Script
# Sets up internal LendingClub distribution

echo "🏢 Setting up LCAgents for internal LendingClub distribution..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from LCAgents project root directory"
    exit 1
fi

# Check if Node.js project
if ! grep -q "@lendingclub/lcagents" package.json; then
    echo "❌ Error: Not in LCAgents project directory"
    exit 1
fi

echo "📦 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

echo "📝 Initializing Git repository..."
git init

# Add .gitignore for internal development
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
.nyc_output/

# Cache
.cache/
.parcel-cache/

# Temporary files
.tmp/
temp/

# LendingClub specific
.lc-secrets
.internal-config
EOF

echo "📋 Adding files to Git..."
git add .
git commit -m "Initial commit: LCAgents v1.0.0-alpha.1

- Complete Phase 1A Foundation implementation
- NPX CLI with init/uninstall commands  
- TypeScript-based architecture
- Resource resolution system
- Agent loading and validation
- Configuration management
- GitHub integration framework
- Comprehensive testing suite

Ready for internal LendingClub distribution via Git."

echo "🏷️  Creating release tag..."
git tag -a v1.0.0-alpha.1 -m "LCAgents Phase 1A Foundation Release

Features:
- NPX command-line interface
- 11 AI agent definitions ready
- BMAD-Core compatibility layer
- GitHub Copilot integration framework
- Team configuration management
- Internal LendingClub distribution

Installation:
npx git+https://github.lendingclub.com/engineering/lcagents.git init

For LendingClub Engineering Teams Only"

echo "✅ Git repository setup complete!"
echo ""
echo "🔗 Next steps for distribution:"

# Derive repository URLs with environment overrides, then fall back to config/repository.json, then to hardcoded defaults
REPO_GITURL=${REPOSITORY_GITURL:-}
REPO_GITNPX=${REPOSITORY_GITNPX:-}
REPO_RAWBASE=${REPOSITORY_RAWBASE:-}

if [ -z "$REPO_GITURL" ] || [ -z "$REPO_GITNPX" ] || [ -z "$REPO_RAWBASE" ]; then
    if [ -f "./config/repository.json" ]; then
        # Use node to safely parse JSON and print fields
        PARSED_GITURL=$(node -e "console.log(require('./config/repository.json').repository.url)")
        PARSED_OWNER=$(node -e "console.log(require('./config/repository.json').repository.owner)")
        PARSED_NAME=$(node -e "console.log(require('./config/repository.json').repository.name)")
        PARSED_DEFAULT_BRANCH=$(node -e "console.log(require('./config/repository.json').repository.defaultBranch||'main')")

        REPO_GITURL=${REPO_GITURL:-$PARSED_GITURL}
        REPO_GITNPX=${REPO_GITNPX:-git+${REPO_GITURL}}
        REPO_RAWBASE=${REPO_RAWBASE:-https://raw.githubusercontent.com/${PARSED_OWNER}/${PARSED_NAME}}
        REPO_DEFAULT_BRANCH=${REPO_DEFAULT_BRANCH:-$PARSED_DEFAULT_BRANCH}
    else
        # Hardcoded fallback
        REPO_GITURL=${REPO_GITURL:-https://github.com/jmaniLC/lcagents.git}
        REPO_GITNPX=${REPO_GITNPX:-git+https://github.com/jmaniLC/lcagents.git}
        REPO_RAWBASE=${REPO_RAWBASE:-https://raw.githubusercontent.com/jmaniLC/lcagents}
        REPO_DEFAULT_BRANCH=${REPO_DEFAULT_BRANCH:-main}
    fi
fi

echo "1. Create repository at: ${REPO_GITURL%.*}"
echo "2. Add remote: git remote add origin ${REPO_GITURL}"
echo "3. Push code: git push -u origin main"
echo "4. Push tags: git push origin --tags"
echo ""
echo "🚀 Then teams can install with:"
echo "   npx ${REPO_GITNPX} init"

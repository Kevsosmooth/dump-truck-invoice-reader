# Git Workflow Guide

## Overview
This document outlines the mandatory Git workflow for the Dump Truck Invoice Reader project. Following this workflow ensures code stability, proper testing, and safe deployment practices.

## Branch Structure

### Main Branches
1. **`main`** (Production)
   - Contains production-ready code only
   - Protected branch - no direct commits allowed
   - Only receives merges from `development` or `hotfix/*` branches
   - Automatically deployed to production environment

2. **`development`** (Integration)
   - Integration branch for all features
   - All feature branches merge here first
   - Used for integration testing
   - Staging environment deploys from this branch

### Supporting Branches
3. **`feature/*`** (Feature Development)
   - Created from: `development`
   - Merge back to: `development`
   - Naming: `feature/descriptive-feature-name`
   - Examples: `feature/field-transformations`, `feature/user-dashboard`

4. **`hotfix/*`** (Emergency Fixes)
   - Created from: `main`
   - Merge back to: `main` AND `development`
   - Naming: `hotfix/issue-description`
   - Use only for critical production bugs

## Workflow Examples

### Starting a New Feature
```bash
# 1. Ensure development is up to date
git checkout development
git pull origin development

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Work on your feature
# ... make changes ...
git add .
git commit -m "feat: implement feature XYZ"

# 4. Keep feature branch updated (periodically)
git checkout development
git pull origin development
git checkout feature/your-feature-name
git merge development

# 5. Push feature branch
git push -u origin feature/your-feature-name
```

### Completing a Feature
```bash
# 1. Ensure all tests pass locally
npm test
npm run lint

# 2. Update from development one final time
git checkout development
git pull origin development
git checkout feature/your-feature-name
git merge development

# 3. Push latest changes
git push origin feature/your-feature-name

# 4. Create Pull Request (via GitHub/GitLab)
# - Source: feature/your-feature-name
# - Target: development
# - Add description and link related issues

# 5. After PR approval and merge
git checkout development
git pull origin development
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Deploying to Production
```bash
# 1. Ensure development is stable and tested
git checkout development
git pull origin development

# 2. Create PR from development to main
# - Requires approval from team lead
# - All CI/CD checks must pass

# 3. After merge to main
git checkout main
git pull origin main
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3
```

### Creating a Hotfix
```bash
# 1. Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/fix-critical-bug

# 2. Make the fix
# ... fix the bug ...
git add .
git commit -m "hotfix: fix critical bug in payment processing"

# 3. Test thoroughly
npm test

# 4. Merge to main
git checkout main
git merge hotfix/fix-critical-bug
git push origin main

# 5. Merge to development
git checkout development
git pull origin development
git merge hotfix/fix-critical-bug
git push origin development

# 6. Clean up
git branch -d hotfix/fix-critical-bug
```

## Commit Message Convention

Follow conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, semicolons, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `perf:` Performance improvements

Examples:
```
feat: add field transformation support for date parsing
fix: resolve date parsing issue with Azure text fields
docs: update API documentation for field transformations
refactor: simplify model configuration logic
```

## Protected Branch Rules

### Main Branch Protection
- Require pull request reviews (minimum 1)
- Dismiss stale pull request approvals
- Require status checks to pass:
  - Tests must pass
  - Linting must pass
  - Build must succeed
- Require branches to be up to date
- Include administrators in restrictions

### Development Branch Protection
- Require pull request reviews (minimum 1)
- Require status checks to pass
- No force pushes allowed

## Best Practices

1. **Keep branches small and focused**
   - One feature per branch
   - Easier to review and test
   - Reduces merge conflicts

2. **Update frequently**
   - Pull from `development` daily
   - Merge `development` into your feature branch regularly
   - Prevents large merge conflicts

3. **Test before merging**
   - Run all tests locally
   - Test manual workflows
   - Check for console errors

4. **Clean up after yourself**
   - Delete merged branches
   - Keep branch list manageable

5. **Communicate**
   - Use descriptive branch names
   - Write clear commit messages
   - Update PR descriptions

## CI/CD Integration

### On Feature Branches
- Run tests on every push
- Run linting checks
- Build validation

### On Development Branch
- All feature branch checks
- Deploy to staging environment
- Run integration tests
- Run E2E tests

### On Main Branch
- All development branch checks
- Deploy to production
- Create release notes
- Tag release version

## Troubleshooting

### Merge Conflicts
```bash
# 1. Update your branch
git checkout feature/your-feature
git merge development

# 2. Resolve conflicts in your editor
# Look for <<<<<<< HEAD markers

# 3. Add resolved files
git add .

# 4. Complete the merge
git commit

# 5. Test everything works
npm test
```

### Accidentally Committed to Wrong Branch
```bash
# If you haven't pushed yet
git reset HEAD~1 --soft
git stash
git checkout correct-branch
git stash pop
git add .
git commit -m "your message"
```

### Need to Undo a Merge
```bash
# Find the commit before the merge
git log --oneline

# Reset to that commit (if not pushed)
git reset --hard <commit-hash>

# If already pushed, create a revert commit
git revert -m 1 <merge-commit-hash>
```

## Summary

1. **Never commit directly to `main`**
2. **Always create features from `development`**
3. **Test thoroughly before merging**
4. **Keep branches updated**
5. **Follow naming conventions**
6. **Write clear commit messages**
7. **Delete branches after merging**

This workflow ensures:
- Production stability
- Proper testing cycles
- Clear development history
- Easy rollback capabilities
- Parallel development support
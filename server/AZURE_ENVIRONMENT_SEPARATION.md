# Azure Blob Storage Environment Separation

## Overview
The application now separates Azure blob storage files between production and development environments to prevent conflicts and ensure proper data isolation.

## How It Works

### Environment Detection
The environment is determined by the `NODE_ENV` environment variable:
- `NODE_ENV=production` → Files stored under `production/` prefix
- `NODE_ENV=development` (or any other value) → Files stored under `development/` prefix

### File Structure
All blob paths are automatically prefixed with the environment:

```
documents/                          # Container
├── development/                    # Development environment
│   └── users/
│       └── {userId}/
│           └── sessions/
│               └── {sessionId}/
│                   ├── originals/
│                   ├── pages/
│                   ├── processed/
│                   └── exports/
└── production/                     # Production environment
    └── users/
        └── {userId}/
            └── sessions/
                └── {sessionId}/
                    ├── originals/
                    ├── pages/
                    ├── processed/
                    └── exports/
```

### Implementation Details

1. **Automatic Prefixing**: All uploads through `uploadToBlob()` automatically prepend the environment prefix
2. **Path Extraction**: The `extractBlobPath()` function removes the environment prefix when extracting paths from URLs
3. **Backward Compatibility**: The system handles blob paths with or without environment prefixes

### Testing
Run the test script to verify environment separation:

```bash
cd server
node src/test-environment-separation.js
```

### Configuration
Set the `NODE_ENV` variable in your `.env` file:

```env
NODE_ENV=development  # For development
# or
NODE_ENV=production   # For production
```

### Important Notes

1. **Session IDs**: Even with environment separation, session IDs could still theoretically collide between environments. Consider adding environment-specific prefixes to session IDs if this becomes an issue.

2. **Migration**: Existing files without environment prefixes will need to be migrated or will be inaccessible through the new system.

3. **Cross-Environment Access**: Files from one environment cannot be accessed when running in another environment.
# Invalid Content Source Format Error

## Error Message
"Invalid content source: Source Uri must include container path"

## Current URL Format
```
https://dumptruckinvoicereader.blob.core.windows.net/training-documents/demo-user/a57c6250-6d57-4ad9-8061-aa8dd80e62f7?sastoken
```

## Issue
The URL already includes the container name "training-documents" in the path, but Azure might be expecting a different format.

## Possible Solutions

### 1. Use Account-level SAS instead of Container-level
Currently using container-level SAS which might not be compatible with the training API.

### 2. Try Container URL with Prefix Parameter Again
Maybe the folder-specific URL approach doesn't work for this API version.

### 3. Check SAS Permissions
Current permissions are "rl" (read, list). Might need additional permissions.

## Investigation Needed
- Check Azure documentation for the exact URL format expected
- Try different SAS URL formats
- Verify API version compatibility
# Azure Document Intelligence Training Fixes

## Overview
This document tracks all the issues found in the custom model training implementation and the fixes needed to make it work properly with Azure Document Intelligence.

## Critical Issues to Fix

### 1. Label Format Generation (HIGH PRIORITY)
**File**: `server/src/services/azure-training-service.ts:357-407`
**Issue**: 
- Incorrect coordinate normalization
- Wrong bounding box format (needs 8 points, not 4)
- Missing required fields in label structure

**Fix Required**:
- Convert [x1,y1,x2,y2] to proper 8-point format
- Ensure coordinates are in correct range (0-1)
- Add all required fields for Azure label format

### 2. OCR File Generation (HIGH PRIORITY)
**File**: `server/src/services/azure-training-service.ts:122-147`
**Issue**: 
- Creating empty OCR files won't work for training
- Azure needs actual text and bounding boxes

**Fix Required**:
- Either implement proper OCR using Azure's built-in OCR
- Or switch to unlabeled training mode
- Remove dummy OCR file generation

### 3. File Organization in Blob Storage (MEDIUM PRIORITY)
**File**: `server/src/routes/model-training.ts:183`
**Issue**: 
- Files uploaded to root directory
- Should be organized in folders: `userId/projectId/filename`

**Fix Required**:
- Update file upload path structure
- Ensure training service looks in correct location

### 4. Build Mode Parameter (LOW PRIORITY)
**File**: `server/src/routes/model-training.ts:371`
**Issue**: 
- Passing string directly instead of proper enum value

**Fix Required**:
- Map 'neural' and 'template' to correct DocumentModelBuildMode enum

### 5. Missing Field Schema for Neural Models (MEDIUM PRIORITY)
**Issue**: 
- Neural models require field definitions
- Current implementation doesn't provide field schema

**Fix Required**:
- Add field schema definition support
- Update training options to include fields

## Implementation Plan

### Phase 1: Fix Label Format
1. Update `generateLabelFormat` function to create proper Azure format
2. Fix coordinate transformation
3. Test with sample data

### Phase 2: Handle OCR Requirements
1. Option A: Implement proper OCR integration
2. Option B: Switch to unlabeled training
3. Remove dummy OCR file generation

### Phase 3: Fix File Organization
1. Update upload paths in both services
2. Ensure consistent path handling
3. Update SAS URL generation if needed

### Phase 4: Fix Build Mode and Add Features
1. Fix build mode enum mapping
2. Add field schema support
3. Add better error handling

## Testing Checklist
- [ ] Upload documents to correct blob location
- [ ] Generate proper label files
- [ ] Start training without errors
- [ ] Monitor training progress
- [ ] Test trained model
- [ ] Handle errors gracefully

## Notes
- Current storage account: `dumptruckinvoicereader`
- Container: `training-documents`
- Min documents: 5 for template, 1 for neural
- Training typically takes 20-30 minutes
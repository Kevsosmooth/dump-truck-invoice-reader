# Implementation Fix for Label Text Values

## Quick Fix Implementation (Can be done immediately)

### 1. Update DocumentLabeling.tsx

Replace the label creation (around line 229-236) with:

```typescript
// Add state for text input dialog
const [textInputDialog, setTextInputDialog] = useState<{
  open: boolean;
  boundingBox: BoundingBox | null;
}>({ open: false, boundingBox: null });

// Modify handleCanvasMouseUp to show dialog
const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... existing code ...
  
  if (!isDrawing || !currentBox || currentBox.width < 10 || currentBox.height < 10) {
    // ... existing code ...
    return;
  }

  // Instead of immediately adding label, show text input dialog
  setTextInputDialog({ open: true, boundingBox: currentBox });
  setIsDrawing(false);
};

// Add dialog handler
const handleTextInput = (text: string) => {
  if (!text.trim()) {
    alert('Please enter the text value');
    return;
  }

  const newLabel: LabeledField = {
    id: Math.random().toString(36).substr(2, 9),
    name: fieldName,
    type: selectedFieldType,
    boundingBox: textInputDialog.boundingBox!,
    value: text, // Use actual text instead of empty string
    pageNumber: 1
  };

  const updatedDocs = [...documents];
  updatedDocs[currentDocIndex].labels.push(newLabel);
  setDocuments(updatedDocs);

  setTextInputDialog({ open: false, boundingBox: null });
  setCurrentBox(null);
};
```

### 2. Remove the 'sample value' fallback

In the saveLabels function (line 275), change:
```typescript
value: label.value || 'sample value',
```

To:
```typescript
value: label.value, // Send actual value, no fallback
```

### 3. Add validation

Before saving, validate all labels have text:
```typescript
const saveLabels = async () => {
  // Validate all labels have text
  const labelsWithoutText = currentDoc.labels.filter(l => !l.value || !l.value.trim());
  if (labelsWithoutText.length > 0) {
    alert(`Please provide text values for all ${labelsWithoutText.length} labels`);
    return;
  }
  
  // ... rest of save logic
};
```

### 4. Add UI for text input

Add a simple dialog/modal component:
```tsx
{textInputDialog.open && (
  <div className="modal">
    <div className="modal-content">
      <h3>Enter the text in the selected region</h3>
      <input
        type="text"
        autoFocus
        onKeyPress={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            handleTextInput(e.currentTarget.value);
          }
        }}
      />
      <button onClick={() => {
        const input = document.querySelector('.modal input') as HTMLInputElement;
        if (input?.value) {
          handleTextInput(input.value);
        }
      }}>
        Add Label
      </button>
    </div>
  </div>
)}
```

## Testing the Fix

1. Upload documents to a project
2. Draw bounding boxes around text
3. Enter the actual text you see in each box
4. Save labels
5. Start training

The label files should now contain real text values, and Azure training should work!

## Next Steps

After implementing the quick fix:
1. Test with a small set of documents
2. Verify label files in blob storage have real text
3. Attempt training again
4. If successful, plan for automated text extraction
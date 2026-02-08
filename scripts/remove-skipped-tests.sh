#!/bin/bash

# Script to remove .skip from all test files in compiler-v2
# This enables previously skipped tests that should now pass after the block-scope fix

echo "Removing it.skip and describe.skip from all test files..."

# Find all test files in compiler-v2
FILES=$(find packages/compiler-v2/src/__tests__ -name "*.test.ts" -type f)

for FILE in $FILES; do
    # Check if file contains it.skip or describe.skip
    if grep -q "\.skip(" "$FILE"; then
        echo "Processing: $FILE"
        # Use perl for in-place replacement (more portable than sed -i)
        perl -i -pe 's/it\.skip\(/it\(/g' "$FILE"
        perl -i -pe 's/describe\.skip\(/describe\(/g' "$FILE"
    fi
done

echo ""
echo "Done! All .skip modifiers have been removed."
echo ""
echo "Files processed:"
grep -l "was changed" /dev/null 2>/dev/null || find packages/compiler-v2/src/__tests__ -name "*.test.ts" -exec grep -l "it\(" {} \; 2>/dev/null | head -20
echo ""
echo "Verify with: grep -r 'it\.skip\|describe\.skip' packages/compiler-v2/src/__tests__/"
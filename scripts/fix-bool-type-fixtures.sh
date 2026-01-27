#!/bin/bash
# Fix fixtures that use 'bool' type (not valid in Blend65 - use 'byte' instead)
# Run from project root: ./scripts/fix-bool-type-fixtures.sh

set -e
cd "$(dirname "$0")/.."

FIXTURES_DIR="packages/compiler/fixtures/10-integration/real-programs"

echo "Fixing bool type issues in fixtures..."

# List of files to fix
FILES=(
  "snake-game.blend"
  "breakout-paddle.blend"
  "platformer-physics.blend"
  "timer-countdown.blend"
  "sid-player.blend"
  "raster-bars.blend"
  "string-utils.blend"
  "math-utils.blend"
)

for file in "${FILES[@]}"; do
  filepath="$FIXTURES_DIR/$file"
  if [ -f "$filepath" ]; then
    echo "  Fixing $file..."
    # Replace ': bool' with ': byte'
    sed -i '' 's/: bool/: byte/g' "$filepath"
    # Replace '= true' with '= 1' 
    sed -i '' 's/= true/= 1/g' "$filepath"
    # Replace '= false' with '= 0'
    sed -i '' 's/= false/= 0/g' "$filepath"
    # Replace '!running' with 'running == 0' (not operator on flag)
    sed -i '' 's/!running/running == 0/g' "$filepath"
    sed -i '' 's/!gameOver/gameOver == 0/g' "$filepath"
    sed -i '' 's/!timerActive/timerActive == 0/g' "$filepath"
    sed -i '' 's/!onGround/onGround == 0/g' "$filepath"
    sed -i '' 's/!playing/playing == 0/g' "$filepath"
  fi
done

# Fix edge case fixture
EDGE_FILE="packages/compiler/fixtures/20-edge-cases/boundary-values/nested-loop-depth.blend"
if [ -f "$EDGE_FILE" ]; then
  echo "  Fixing nested-loop-depth.blend..."
  # Fix word->byte cast issue by changing poke to use byte properly
  sed -i '' 's/poke(\$0400, total \& \$FF)/poke($0400, (total \& $FF) as byte)/g' "$EDGE_FILE"
  sed -i '' 's/poke(\$0401, total >> 8)/poke($0401, (total >> 8) as byte)/g' "$EDGE_FILE"
fi

echo "Done! Run ./compiler-test e2e to verify fixes."
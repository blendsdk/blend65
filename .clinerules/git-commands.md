### Cline Commands

**CRITICALLY IMPORTANT**

1. IMPORTANT: Allways perform the `gitcmp` or the `gitcm` commands in a new "Task With Context"

When the user provides these keywords, Cline should perform the following actions:

#### `gitcm` - Git Commit with Message

1. Stage all changes (`git add .`)
2. Create a detailed, descriptive commit message following format:

   ```
   feat(package): implement feature description

   - Specific change 1
   - Specific change 2
   - Tests added/updated
   ```

3. Commit the changes (`git commit -m "detailed message"`)

#### `gitcmp` - Git Commit, Rebase, and Push

1. Perform `gitcm` workflow (stage all changes and create detailed commit)
2. Pull and rebase if needed (`git pull --rebase`)
3. If there are no conflicts, push to remote (`git push`)
4. Report any conflicts for manual resolution

# Building and Testing
1. Always use `yarn` instead of `npm`
2. Always make sure the project builds and tests correctly before pushing to git. Use `yarn clean && yarn build && yarn test` from the project root

# Cline Commands for Git Workflow
When the user provides these keywords, Cline should perform the following actions:

## gitcm
**Git Commit with Message** - Cline should:
1. Stage all changes (`git add .`)
2. Create a detailed, descriptive commit message
3. Commit the changes (`git commit -m "detailed message"`)

## gitcmp
**Git Commit, rebase, and Push** - Cline should:
1. Perform `gitcm` workflow (stage all changes and create detailed commit)
2. Pull and Rebase if needed (`git pull --rebase`)
3. If there are no conflicts, push to remote (`git push`)

These are instructions for Cline to automate the git workflow, not shell aliases or commands to be run directly in the terminal.

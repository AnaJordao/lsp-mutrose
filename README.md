# lsp-mutrose

Currently, the MutRoSe LSP can:

- Automatically create goal and task templates (just type goal or task and select the desired option) with correct numbered names
- Suggestions appear according to the attributes of each node's goal type (for example, queriedProperty can only appear in a goal with type query)
- When defining the monitor value, autocomplete shows the variables defined in the controls declared in the document
- When defining the monitor type, possible classes appear as suggestions based on the world knowledge

## How to run:

### Tests

To execute every unit test, client and serve included, run the following command to run a test script:

```bash
npm run test
```

If you don't want to use the script, you can use:

```bash
npm run test:all
```

If you want to execute the client and server tests separeted, use the following commands, respectively:

```bash
npm run test:client
npm run test:server
```
const vscode = {
  workspace: {
    createFileSystemWatcher: jest.fn().mockReturnValue({}),
  },
};

export = vscode;

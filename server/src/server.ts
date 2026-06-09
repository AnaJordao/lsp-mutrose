import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  Location,
  Position,
  Range,
  DefinitionParams,
  Hover,
  MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentSymbolParams, SymbolInformation, SymbolKind } from 'vscode-languageserver/node';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import * as fs from 'fs';
import * as path from 'path';
import { validateAchieveCondition, validateQueriedProperty } from './oclParser';


const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments<TextDocument>(TextDocument);

let workspaceFolders: string[] = [];

function fileUriToPath(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }

  let filePath = decodeURIComponent(uri.replace('file://', ''));
  if (process.platform === 'win32' && filePath.startsWith('/')) {
    filePath = filePath.substring(1);
  }
  return filePath;
}

// take the classes defined in the world knowledge xml of a given string
function takeClassesFromWorldKnowledgeXml(xmlElement: string): string[] {
  const classes = new Set<string>();
  const worldDbMatch = xmlElement.match(/<world_db[^>]*>([\s\S]*?)<\/world_db>/i);
  const contentToParse = worldDbMatch ? worldDbMatch[1] : xmlElement;
  const classNameRegex = /<([A-Za-z_][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g;

  let match: RegExpExecArray | null;
  while ((match = classNameRegex.exec(contentToParse)) !== null) {
    const tagName = match[1];
    if (tagName.toLowerCase() !== 'world_db') {
      classes.add(tagName);
    }
  }
  return Array.from(classes).sort();
}

// map every directory that can have a world knowledge xml and find all the classes 
// defined in those, returning a sorted list with all the classes names
function readWorldKnowledgeClassesForDocument(doc: TextDocument): string[] {
  const classes = new Set<string>();
  const gmFilePath = fileUriToPath(doc.uri);
  const gmDirName = path.dirname(gmFilePath);
  const candidateDirs = [
    path.resolve(gmDirName, '..', 'knowledge')
  ];

  for (const workspaceFolder of workspaceFolders) {
    candidateDirs.push(path.resolve(workspaceFolder, 'knowledge'));
    candidateDirs.push(path.resolve(workspaceFolder, 'examples'));
  }

  for (const dirPath of candidateDirs) {
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    if (path.basename(dirPath).toLowerCase() === 'examples') {
      const exampleFolders = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      for (const exampleFolder of exampleFolders) {
        const knowledgeDir = path.join(dirPath, exampleFolder, 'knowledge');
        if (!fs.existsSync(knowledgeDir)) {
          continue;
        }

        const files = fs.readdirSync(knowledgeDir)
          .filter(fileName => fileName.toLowerCase().endsWith('.xml'));
        for (const fileName of files) {
          const fullPath = path.join(knowledgeDir, fileName);
          try {
            const xmlContent = fs.readFileSync(fullPath, 'utf8');
            for (const className of takeClassesFromWorldKnowledgeXml(xmlContent)) {
              classes.add(className);
            }
          } catch {
            // Ignore malformed/unreadable knowledge files for completion fallback.
          }
        }
      }
      continue;
    }

    if (!fs.statSync(dirPath).isDirectory()) {
      continue;
    }

    const files = fs.readdirSync(dirPath)
      .filter(fileName => fileName.toLowerCase().endsWith('.xml'));

    for (const fileName of files) {
      const fullPath = path.join(dirPath, fileName);
      try {
        const xmlContent = fs.readFileSync(fullPath, 'utf8');
        for (const className of takeClassesFromWorldKnowledgeXml(xmlContent)) {
          classes.add(className);
        }
      } catch {
        // Ignore malformed/unreadable knowledge files for completion fallback.
      }
    }
  }

  return Array.from(classes).sort();
}

export interface VariableInfo {
  location: Location;
  value?: string;
}

interface GmNode {
  id: string;
  text: string;
  type: 'istar.Goal' | 'istar.Task';
  x: number;
  y: number;
  customProperties: Record<string, string>;
}

interface GmActor {
  id: string;
  text: string;
  type: string;
  nodes: GmNode[];
}

interface GmFile {
  actors: GmActor[];
  orphans: GmNode[];
  dependencies: unknown[];
  links: unknown[];
}

interface FlowMetadata {
  type: 'option' | 'input' | 'boolean';
  propertyName?: string;
  goTo?: string;
  requiresConfirmation?: boolean;
}

interface Flow {
  message: string;
  options: { label: string; next?: string }[];
  metadata?: FlowMetadata;
  onChange?: (input: string) => Promise<void> | void;
}

const variableDefinitions = new Map<string, VariableInfo>();

const flow: Record<string, Flow> = {
  goal: {
    message: "Define Goal",
    options: [
      { label: "Name", next: "goalName" },
      { label: "Goal Type", next: "goalType" },
    ],
    metadata: {type: "option", propertyName: "istar.Goal"}
  },
  goalName: {
    message: "Define Goal Name",
    options: [],
    metadata: {type: "input", goTo: "goal", propertyName: "Name"},
  },
  goalType: {
    message: "Define Goal Type",
    options: [
      { label: "Achieve", next: "achieve" },
      { label: "Query", next: "query" },
      { label: "Perform", next: "goalType" },
    ],
    metadata: {type: "option", propertyName: "GoalType", requiresConfirmation: true },
  },
  achieve: {
    message: "Define the attributes",
    options: [
      { label: "Achieve Condition", next: "achieveCondition" },
      { label: "Controls", next: "controls" },
      { label: "Monitors", next: "monitors" },
      { label: "Group", next: "group" },
    ],
    metadata: {type: "option"}
  },
  achieveCondition: {
    message: "Define the achieve condition",
    options: [],
    metadata: {type: "input", goTo: "achieve", propertyName: "AchieveCondition"},
  },
  controls: {
    message: "Define the controls",
    options: [],
    metadata: {type: "input", goTo: "achieve", propertyName: "Controls"},
  },
  monitors: {
    message: "Define the monitors",
    options: [],
    metadata: {type: "input", goTo: "achieve", propertyName: "Monitors"},
  },
  group: {
    message: "Define the group",
    options: [
      { label: "True", next: "divisible" },
      { label: "False", next: "achieve" },
    ],
    metadata: {type: "boolean", propertyName: "Group"},
  },
  divisible: {
    message: "Define the divisible",
    options: [
      { label: "True", next: "achieve" },
      { label: "False", next: "achieve" },
    ],
    metadata: {type: "boolean", propertyName: "Divisible"},
  },
  query: {
    message: "Define the attributes",
    options: [
      { label: "Queried Property", next: "queriedProperty" },
    ],
    metadata: {type: "option", goTo: "goalType"}
  },
  queriedProperty: {
    message: "Define the queried property",
    options: [],
    metadata: {type: "input", goTo: "goalType", propertyName: "QueriedProperty"},
  },
  task: {
    message: "Define Task",
    options: [
      { label: "Name", next: "taskName" },
      { label: "Task Attributes", next: "taskAttributes" },
    ],
    metadata: {type: "option", propertyName: "istar.Task"}
  },
  taskName: {
    message: "Define Task Name",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Name"},
  },
  taskAttributes: {
    message: "Define the task attributes",
    options: [
      { label: "Location", next: "location" },
      { label: "Params", next: "params" },
      { label: "Robot Numbers", next: "robotNumbers" },
    ],
    metadata: {type: "option" }
  },
  location: {
    message: "Choose an option to define the location",
    options: [
      { label: "Variables", next: "locationVariables" },
      { label: "Name", next: "locationName" },
      { label: "Type", next: "locationType" },
      { label: "Collection", next: "locationCollection" },
    ],
    metadata: {type: "option" },
  },
  locationVariables: {
    message: "Choose the variables to define the location",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Location"},
  },
  locationName: {
    message: "Choose the name to define the location",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Location"},
  },
  locationType: {
    message: "Choose the type to define the location",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Location"},
  },
  locationCollection: {
    message: "Choose the collection to define the location",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Location"},
  },
  params: {
    message: "Define the params",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "Params"},
  },
  robotNumbers: {
    message: "Define the number of robots",
    options: [
      { label: "Number", next: "robotSingleNumber" },
      { label: "Range", next: "robotNumRange" },
    ],
    metadata: {type: "option" },
  },
  robotSingleNumber: {
    message: "Choose the range of number",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "RobotNumber"},
  },
  robotNumRange: {
    message: "Choose the range of number",
    options: [],
    metadata: {type: "input", goTo: "task", propertyName: "RobotNumber"},
  },
};

// Property to context mapping for validation
const propertyContextMap: Record<string, string[]> = {
  "AchieveCondition": ["achieve"],
  "Controls": ["achieve", "query"],
  "Monitors": ["goal", "achieve", "query"],
  "Group": ["achieve"],
  "Divisible": ["achieve"],
  "QueriedProperty": ["query"],
  "Location": ["task"],
  "Params": ["task"],
  "RobotNumber": ["task"],
  "Name": ["goal", "task"],
  "GoalType": ["goal"]
};

// Flow step to context mapping for completions
const flowStepContextMap: Record<string, string[]> = {
  // Goal level steps (available in all goal contexts)
  "goalName": ["goal", "achieve", "query"],
  "goalType": ["goal"],
  
  // Achieve goal steps
  "achieveCondition": ["achieve"],
  "controls": ["achieve", "query"],
  "monitors": ["goal", "achieve", "query"],
  "group": ["achieve"],
  "divisible": ["achieve"],
  
  // Query goal steps
  "queriedProperty": ["query"],
  
  // Task steps (available in all task contexts)
  "taskName": ["task"],
  "taskAttributes": ["task"],
  "location": ["task"],
  "locationVariables": ["task"],
  "locationName": ["task"],
  "locationType": ["task"],
  "locationCollection": ["task"],
  "params": ["task"],
  "robotNumbers": ["task"],
  "robotSingleNumber": ["task"],
  "robotNumRange": ["task"]
};

// Detect the context (goal, achieve, query, task) based on the current line and its surrounding lines in the document
export function detectContextFromDocument(text: string, currentLine: number): { context: string; goalType: string } {
  const lines = text.split(/\r?\n/);
  let context = '';
  let goalType = '';
  let foundGoalStart = false;
  let foundTaskStart = false;
  let pendingGoalType = '';
  
  // Look backwards from current line to find context
  for (let i = currentLine; i >= 0; i--) {
    const line = lines[i];
    
    // Checks if is goal or task
    const goalMatch = line.match(/istar\.Goal/);
    const taskMatch = line.match(/istar\.Task/);
    
    if (taskMatch && !foundTaskStart && !foundGoalStart) {
      foundTaskStart = true;
      context = 'task';
      break;
    } else if (goalMatch && !foundGoalStart && !foundTaskStart) {
      foundGoalStart = true;
      // Apply goalType unless we're on the definition line and it's the only content
      if (pendingGoalType) {
        goalType = pendingGoalType;
        context = goalType;
      } else {
        context = 'goal';
      }
      break;
    }
    
    // Checks GoalType - store it for when we find the Goal
    const goalTypeMatch = line.match(/GoalType\s*[=:]\s*['"](Achieve|Query|Perform)['"]?/i);
    if (goalTypeMatch && !pendingGoalType) {
      pendingGoalType = goalTypeMatch[1].toLowerCase();
    }
  }
  
  return { context, goalType };
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders.map(folder =>
      fileUriToPath(folder.uri)
    );
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':']
      },
      definitionProvider: true,
      hoverProvider: true,
      workspaceSymbolProvider: true,
      documentSymbolProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true
        }
      }
    }
  };
});


documents.onDidOpen(e => {
  indexDocument(e.document);     
  validateTextDocument(e.document);
});

// Validate Goal Model
function validateGmFile(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    try {
        const gmData: GmFile = JSON.parse(text);
        
        // Validate all nodes in actors
        if (gmData.actors && Array.isArray(gmData.actors)) {
            for (const actor of gmData.actors) {
                if (actor.nodes && Array.isArray(actor.nodes)) {
                    for (const node of actor.nodes) {
                        validateGmNode(node, text, diagnostics);
                    }
                }
            }
        }
        
        // Validate orphan nodes
        if (gmData.orphans && Array.isArray(gmData.orphans)) {
            for (const node of gmData.orphans) {
                validateGmNode(node, text, diagnostics);
            }
        }
        
    } catch (error) {
        // JSON parsing error
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 }
            },
            message: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'MutRoSe GM Validator'
        });
    }
    
    return diagnostics;
}

// Validate individual goal or task node in .gm file
function validateGmNode(node: GmNode, text: string, diagnostics: Diagnostic[]): void {
    if (!node.customProperties) {
        return;
    }
    
    const properties = node.customProperties;
    const nodeType = node.type;
    
    // Determine context based on node type
    let context = '';
    let goalType = '';
    
    if (nodeType === 'istar.Goal') {
        context = 'goal';
        goalType = properties.GoalType?.toLowerCase() || '';
        if (goalType) {
            context = goalType;
        }
    } else if (nodeType === 'istar.Task') {
        context = 'task';
    }
    
    // Find the position of this node's customProperties in the JSON text
    const nodeIdPattern = new RegExp(`"id"\\s*:\\s*"${node.id}"`, 'g');
    const match = nodeIdPattern.exec(text);
    
    if (!match) {
        return;
    }
    
    // Validate each property in customProperties
    const nodeText = text.substring(match.index);
    for (const [propName] of Object.entries(properties)) {
        // Skip standard properties
        if (propName === 'Description') {
            continue;
        }
        
        // Find the property line inside this node's JSON slice, not the whole document.
        const propPattern = new RegExp(`"${propName}"\\s*:\\s*"[^"]*"`, 'g');
        const propMatch = propPattern.exec(nodeText);
        
        if (!propMatch) {
            continue;
        }
        
        const propIndex = match.index + propMatch.index;
        const propLines = text.substring(0, propIndex).split('\n');
        const propLine = propLines.length - 1;
        const propChar = propLines[propLines.length - 1].length;

        const valueStartInMatch = propMatch[0].indexOf(':');
        const valueQuoteStart = valueStartInMatch >= 0 ? propMatch[0].indexOf('"', valueStartInMatch) : -1;
        const valueQuoteEnd = valueQuoteStart >= 0 ? propMatch[0].lastIndexOf('"') : -1;
        const valueStartIndex = valueQuoteStart >= 0 ? propIndex + valueQuoteStart + 1 : propIndex;
        const valueEndIndex = valueQuoteEnd >= 0 ? propIndex + valueQuoteEnd : propIndex + propMatch[0].length;

        const valueStartLines = text.substring(0, valueStartIndex).split('\n');
        const valueLine = valueStartLines.length - 1;
        const valueChar = valueStartLines[valueStartLines.length - 1].length;

        const valueEndLines = text.substring(0, valueEndIndex).split('\n');
        const valueEndLine = valueEndLines.length - 1;
        const valueEndChar = valueEndLines[valueEndLines.length - 1].length;
        
        const validContexts = propertyContextMap[propName];
        
        // Validate property based on context
        if (validContexts) {
            let isValidContext = false;
            
            // Special handling for GoalType: always validate against "goal" context, not the derived goalType
            if (propName === 'GoalType' && nodeType === 'istar.Goal') {
                isValidContext = validContexts.includes('goal');
            } else if (goalType) {
                isValidContext = validContexts.includes(goalType);
            } else {
                isValidContext = validContexts.includes(context);
            }
            
            if (!isValidContext) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                  start: { line: propLine, character: propChar },
                  end: { line: propLine, character: propChar + propName.length + 2 }
                    },
                    message: `Property '${propName}' is not valid for ${nodeType}${goalType ? ` with GoalType '${goalType}'` : ''}. Valid contexts: ${validContexts.join(', ')}`,
                    source: 'MutRoSe GM Validator'
                });
            }
        }
        
        // Check if query goals have any achieve-only properties
        if (goalType === 'query') {
            const achieveOnlyProps = ['AchieveCondition', 'Group', 'Divisible'];
            if (achieveOnlyProps.includes(propName)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: propLine, character: propChar },
                        end: { line: propLine, character: propChar + propName.length + 2 }
                    },
                    message: `Property '${propName}' can only be used with 'Achieve' goals, not 'Query' goals.`,
                    source: 'MutRoSe GM Validator'
                });
            }
        }
        
        // Check if achieve goals have any query-only properties
        if (goalType === 'achieve') {
            const queryOnlyProps = ['QueriedProperty'];
            if (queryOnlyProps.includes(propName)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: propLine, character: propChar },
                        end: { line: propLine, character: propChar + propName.length + 2 }
                    },
                    message: `Property '${propName}' can only be used with 'Query' goals, not 'Achieve' goals.`,
                    source: 'MutRoSe GM Validator'
                });
            }
        }
        
        // Validate QueriedProperty format for Query goals
        if (propName === 'QueriedProperty' && goalType === 'query') {
            const value = properties[propName];
            const queriedPropertyErrors = validateQueriedProperty(value);
            for (const error of queriedPropertyErrors) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                    start: { line: valueLine, character: valueChar },
                    end: { line: valueEndLine, character: valueEndChar }
                    },
                    message: error,
                    source: 'MutRoSe OCL Validator'
                });
            }
        }
        
        // Validate AchieveCondition format for Achieve goals
        if (propName === 'AchieveCondition' && goalType === 'achieve') {
            const value = properties[propName];
            const monitorVars = properties['Monitors'] || '';
            const controlVars = properties['Controls'] || '';
            const achieveErrors = validateAchieveCondition(value, monitorVars, controlVars);
            for (const error of achieveErrors) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                    start: { line: valueLine, character: valueChar },
                    end: { line: valueEndLine, character: valueEndChar }
                    },
                    message: error,
                    source: 'MutRoSe OCL Validator'
                });
            }
        }
    }
}

// Validate the entire text document
export async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    // Check if this is a .gm file (JSON format)
    if (textDocument.uri.endsWith('.gm')) {
        return validateGmFile(text);
    }

    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for numbers at beginning of variable
        const numberMatch = line.match(/\b\d\w*/);
        if (numberMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: i, character: numberMatch.index! },
                    end: { line: i, character: numberMatch.index! + numberMatch[0].length }
                },
                message: `Syntax error: numbers are not allowed at the beginning of the variable.`,
                source: 'MutRoSe'
            });
        }

        // Flow validation: detect context for current line
        const { context: currentContext, goalType: currentGoalType } = detectContextFromDocument(text, i);

        // Validate properties based on context
        for (const [property, validContexts] of Object.entries(propertyContextMap)) {
            const propertyRegex = new RegExp(`\\b${property}\\b`, 'i');
            const propertyMatch = line.match(propertyRegex);
            
            if (propertyMatch && currentContext) {
                // Skip validation if this appears to be a property value, not a property name
                const matchIndex = propertyMatch.index!;
                const beforeMatch = line.substring(0, matchIndex);
                
                const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);
                
                if (!isLikelyValue) {
                    const isValidContext = validContexts.includes(currentContext) || 
                                         (currentGoalType && validContexts.includes(currentGoalType));
                    
                    if (!isValidContext) {
                        const startChar = matchIndex;
                        const endChar = startChar + property.length;
                        
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: i, character: startChar },
                                end: { line: i, character: endChar }
                            },
                            message: `Property '${property}' is not valid in ${currentContext}${currentGoalType ? ` (${currentGoalType})` : ''} context. Valid contexts: ${validContexts.join(', ')}`,
                            source: 'MutRoSe Flow Validator'
                        });
                    }
                }
            }
        }

        // Validate flow steps based on context
        for (const [stepName, validContexts] of Object.entries(flowStepContextMap)) {
            const stepRegex = new RegExp(`\\b${stepName}\\b`, 'i');
            const stepMatch = line.match(stepRegex);
            
            if (stepMatch && currentContext) {
                // Skip validation if this appears to be a property value, not a step name
                const matchIndex = stepMatch.index!;
                const beforeMatch = line.substring(0, matchIndex);
                
                const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);
                
                if (!isLikelyValue) {
                    let isValidContext = false;
                    
                    if (currentGoalType) {
                        isValidContext = validContexts.includes(currentGoalType);
                    } else {
                        isValidContext = validContexts.includes(currentContext);
                    }
                    
                    if (!isValidContext) {
                        const startChar = matchIndex;
                        const endChar = startChar + stepName.length;
                        
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: i, character: startChar },
                                end: { line: i, character: endChar }
                            },
                            message: `Flow step '${stepName}' is not valid in ${currentContext}${currentGoalType ? ` (${currentGoalType})` : ''} context. Valid contexts: ${validContexts.join(', ')}`,
                            source: 'MutRoSe Flow Validator'
                        });
                    }
                }
            }
        }

        // Validate specific achieve-only properties in query context
        if (currentGoalType === 'query') {
            const achieveOnlyProps = ['AchieveCondition', 'Group', 'Divisible'];
            for (const prop of achieveOnlyProps) {
                const propMatch = line.match(new RegExp(`\\b${prop}\\b`, 'i'));
                if (propMatch) {
                    // Skip validation if this appears to be a property value, not a property name
                    const matchIndex = propMatch.index!;
                    const beforeMatch = line.substring(0, matchIndex);
                    const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);
                    
                    if (!isLikelyValue) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: i, character: matchIndex },
                                end: { line: i, character: matchIndex + prop.length }
                            },
                            message: `Property '${prop}' can only be used with 'Achieve' goals, not 'Query' goals.`,
                            source: 'MutRoSe Flow Validator'
                        });
                    }
                }
            }
        }

        // Validate query-only properties in achieve context
        if (currentGoalType === 'achieve') {
            const queryOnlyProps = ['QueriedProperty'];
            for (const prop of queryOnlyProps) {
                const propMatch = line.match(new RegExp(`\\b${prop}\\b`, 'i'));
                if (propMatch) {
                    // Skip validation if this appears to be a property value, not a property name
                    const matchIndex = propMatch.index!;
                    const beforeMatch = line.substring(0, matchIndex);
                    const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);
                    
                    if (!isLikelyValue) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: i, character: matchIndex },
                                end: { line: i, character: matchIndex + prop.length }
                            },
                            message: `Property '${prop}' can only be used with 'Query' goals, not 'Achieve' goals.`,
                            source: 'MutRoSe Flow Validator'
                        });
                    }
                }
            }
        }

    }

    return diagnostics;
}

documents.onDidChangeContent(change => {
  indexDocument(change.document); 
  validateTextDocument(change.document).then(diagnostics => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  }); 
});

// Index variable definitions in the document for quick lookup during completions and hover
export function indexDocument(doc: TextDocument): Map<string, VariableInfo> {
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const localVariableDefinitions = new Map<string, VariableInfo>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const match = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.*)/);
    if (match) {
      const varName = match[1];
      const varValue = match[2];

      const loc: Location = {
        uri: doc.uri,
        range: Range.create(
          Position.create(lineIndex, 0),
          Position.create(lineIndex, varName.length)
        )
      };

      localVariableDefinitions.set(varName, { location: loc, value: varValue });
      variableDefinitions.set(varName, { location: loc, value: varValue });
    }
  }
  
  return localVariableDefinitions;
}

// Extract all variables defined in Controls fields throughout the .gm file
function extractControlsVariables(text: string): Map<string, string> {
  const variables = new Map<string, string>();
  // Match all Controls fields: "Controls": "varName : Type"
  const controlsRegex = /"Controls"\s*:\s*"([^"]+)"/g;
  let match;
  
  while ((match = controlsRegex.exec(text)) !== null) {
    const controlsValue = match[1];
    // Parse variable definitions (format: "varName : Type" or multiple comma-separated)
    const varDefinitions = controlsValue.split(',').map(v => v.trim());
    
    for (const varDefinition of varDefinitions) {
      const colonIndex = varDefinition.indexOf(':');
      if (colonIndex > 0) {
        const varName = varDefinition.substring(0, colonIndex).trim();
        const varType = varDefinition.substring(colonIndex + 1).trim();
        if (varName) {
          variables.set(varName, varType);
        }
      }
    }
  }
  
  return variables;
}

// Get the next available goal and task numbers for their names
function getNextGoalAndTaskNumbers(text: string): { nextGoalNumber: number; nextTaskNumber: number } {
  let maxGoalNumber = 0;
  let maxTaskNumber = 0;

  const goalRegex = /\bG(\d+)\s*:/gi;
  let goalMatch: RegExpExecArray | null;
  while ((goalMatch = goalRegex.exec(text)) !== null) {
    const parsed = Number.parseInt(goalMatch[1], 10);
    if (!Number.isNaN(parsed)) {
      maxGoalNumber = Math.max(maxGoalNumber, parsed);
    }
  }

  const taskRegex = /\bAT(\d+)\s*:/gi;
  let taskMatch: RegExpExecArray | null;
  while ((taskMatch = taskRegex.exec(text)) !== null) {
    const parsed = Number.parseInt(taskMatch[1], 10);
    if (!Number.isNaN(parsed)) {
      maxTaskNumber = Math.max(maxTaskNumber, parsed);
    }
  }

  return {
    nextGoalNumber: maxGoalNumber + 1,
    nextTaskNumber: maxTaskNumber + 1
  };
}

// Determine the current node context (Goal or Task) and GoalType (Achieve, Query, Perform) based on the text before the cursor in the .gm file
function getCurrentGmNodeContext(textBeforeCursor: string): {
  nodeType: 'Goal' | 'Task' | null;
  goalType: 'achieve' | 'query' | 'perform' | null;
} {
  let nodeType: 'Goal' | 'Task' | null = null;
  let goalType: 'achieve' | 'query' | 'perform' | null = null;

  const typeRegex = /"type"\s*:\s*"istar\.(Goal|Task)"/g;
  let typeMatch: RegExpExecArray | null;
  while ((typeMatch = typeRegex.exec(textBeforeCursor)) !== null) {
    nodeType = typeMatch[1] as 'Goal' | 'Task';
  }

  const customPropertiesIndex = textBeforeCursor.lastIndexOf('"customProperties"');
  if (customPropertiesIndex >= 0) {
    const currentCustomPropertiesText = textBeforeCursor.substring(customPropertiesIndex);
    const goalTypeRegex = /"GoalType"\s*:\s*"(Achieve|Query|Perform)"/gi;
    let goalTypeMatch: RegExpExecArray | null;
    while ((goalTypeMatch = goalTypeRegex.exec(currentCustomPropertiesText)) !== null) {
      goalType = goalTypeMatch[1].toLowerCase() as 'achieve' | 'query' | 'perform';
    }
  }

  return { nodeType, goalType };
}

// Extract existing custom property names from the current "customProperties" block to avoid suggesting duplicates in completions
function getCurrentCustomPropertiesBlock(text: string, offset: number): string {
  const textBeforeCursor = text.substring(0, offset);
  const customPropertiesIndex = textBeforeCursor.lastIndexOf('"customProperties"');
  if (customPropertiesIndex < 0) {
    return '';
  }

  const openBraceIndex = text.indexOf('{', customPropertiesIndex);
  if (openBraceIndex < 0) {
    return '';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(openBraceIndex + 1, i);
      }
    }
  }

  return text.substring(openBraceIndex + 1);
}

// Extract existing custom property names from the current "customProperties" block to avoid suggesting duplicates in completions
function getExistingCustomProperties(text: string, offset: number): Set<string> {
  const existingProperties = new Set<string>();
  const currentCustomPropertiesText = getCurrentCustomPropertiesBlock(text, offset);
  if (!currentCustomPropertiesText) {
    return existingProperties;
  }

  const propRegex = /"([A-Za-z_][\w]*)"\s*:/g;
  let propMatch: RegExpExecArray | null;
  while ((propMatch = propRegex.exec(currentCustomPropertiesText)) !== null) {
    existingProperties.add(propMatch[1]);
  }

  return existingProperties;
}

// Get completion items for .gm (Goal Model)
function getGmCompletionItems(doc: TextDocument, position: Position): CompletionItem[] {
  const completionItems: CompletionItem[] = [];
  const text = doc.getText();
  const offset = doc.offsetAt(position);
  const textBeforeCursor = text.substring(0, offset);
  
  // Check if we're in a nodes array or customProperties section
  const inNodesArray = /"nodes"\s*:\s*\[[^\]]*$/.test(textBeforeCursor);
  const inCustomProperties = /"customProperties"\s*:\s*\{[^}]*$/.test(textBeforeCursor);
  
  // Check if we're typing in the Monitors field value
  const inMonitorsValue = /"Monitors"\s*:\s*"[^"]*$/.test(textBeforeCursor);

  // Check if we're typing the type part of Controls: "varName : <here>"
  const inControlsTypeValue = /"Controls"\s*:\s*"[^"]*:\s*[^"]*$/.test(textBeforeCursor);
  
  // Check if we're typing in AchieveCondition or QueriedProperty fields
  const inAchieveConditionValue = /"AchieveCondition"\s*:\s*"[^"]*$/.test(textBeforeCursor);
  const inQueriedPropertyValue = /"QueriedProperty"\s*:\s*"[^"]*$/.test(textBeforeCursor);
  const inGoalTypeValue = /"GoalType"\s*:\s*"[^"]*$/.test(textBeforeCursor);

  if (inGoalTypeValue) {
    completionItems.push(
      {
        label: 'Achieve',
        kind: CompletionItemKind.EnumMember,
        insertText: 'Achieve',
        documentation: 'Goal type Achieve'
      },
      {
        label: 'Query',
        kind: CompletionItemKind.EnumMember,
        insertText: 'Query',
        documentation: 'Goal type Query'
      },
      {
        label: 'Perform',
        kind: CompletionItemKind.EnumMember,
        insertText: 'Perform',
        documentation: 'Goal type Perform'
      }
    );
    return completionItems;
  }

  if (inControlsTypeValue) {
    const knowledgeClasses = readWorldKnowledgeClassesForDocument(doc);
    for (const className of knowledgeClasses) {
      completionItems.push({
        label: className,
        kind: CompletionItemKind.Class,
        insertText: className,
        detail: 'Knowledge class',
        documentation: `Class from knowledge folder: ${className}`
      });
      completionItems.push({
        label: `Sequence(${className})`,
        kind: CompletionItemKind.Class,
        insertText: `Sequence(${className})`,
        detail: 'Knowledge class sequence',
        documentation: `Sequence of ${className}`
      });
    }
    return completionItems;
  }
  
  // If typing in Monitors, AchieveCondition, or QueriedProperty value, suggest variables from Controls
  if (inMonitorsValue || inAchieveConditionValue || inQueriedPropertyValue) {
    const controlsVars = extractControlsVariables(text);
    controlsVars.forEach((type, varName) => {
      completionItems.push({
        label: varName,
        kind: CompletionItemKind.Variable,
        insertText: varName,
        detail: `: ${type}`,
        documentation: `Variable from Controls: ${varName} : ${type}`
      });
    });
    return completionItems;
  }
  
  // Provide node templates only at node-array level (not inside customProperties)
  if (inNodesArray && !inCustomProperties) {
    const { nextGoalNumber, nextTaskNumber } = getNextGoalAndTaskNumbers(text);

    // Achieve Goal snippet
    completionItems.push({
      label: 'Achieve Goal',
      kind: CompletionItemKind.Snippet,
      insertText: `{
  "id": "\${1:goal-id}",
  "text": "\${2:G${nextGoalNumber}: Goal Name}",
  "type": "istar.Goal",
  "x": \${3:100},
  "y": \${4:100},
  "customProperties": {
    "Description": "",
    "GoalType": "Achieve",
    "AchieveCondition": "\${5:condition}",
    "Controls": "\${6:}",
    "Monitors": "\${7:}"
  }
}`,
      documentation: 'Insert an Achieve Goal node with all attributes',
      insertTextFormat: 2
    });

    // Query Goal snippet
    completionItems.push({
      label: 'Query Goal',
      kind: CompletionItemKind.Snippet,
      insertText: `{
  "id": "\${1:goal-id}",
  "text": "\${2:G${nextGoalNumber}: Goal Name}",
  "type": "istar.Goal",
  "x": \${3:100},
  "y": \${4:100},
  "customProperties": {
    "Description": "",
    "GoalType": "Query",
    "QueriedProperty": "\${5:property}",
    "Controls": "\${6:}",
    "Monitors": "\${7:}"
  }
}`,
      documentation: 'Insert a Query Goal node with all attributes',
      insertTextFormat: 2
    });

    // Task snippet
    completionItems.push({
      label: 'Task',
      kind: CompletionItemKind.Snippet,
      insertText: `{
  "id": "\${1:task-id}",
  "text": "\${2:A${nextTaskNumber}: Task Name}",
  "type": "istar.Task",
  "x": \${3:100},
  "y": \${4:100},
  "customProperties": {
    "Description": "",
    "Params": "\${5:}",
    "Location": "\${6:}",
    "RobotNumber": \${7:1}
  }
}`,
      documentation: 'Insert a Task node with all attributes',
      insertTextFormat: 2
    });

    // Basic Goal (no GoalType specified)
    completionItems.push({
      label: 'Basic Goal',
      kind: CompletionItemKind.Snippet,
      insertText: `{
  "id": "\${1:goal-id}",
  "text": "\${2:G${nextGoalNumber}: Goal Name}",
  "type": "istar.Goal",
  "x": \${3:100},
  "y": \${4:100},
  "customProperties": {
    "Description": "",
    "Monitors": "\${5:}",
    "Controls": "\${6:}"
  }
}`,
      documentation: 'Insert a basic Goal node',
      insertTextFormat: 2
    });
  }
  
  // Provide property completions when in customProperties
  if (inCustomProperties) {
    const { nodeType, goalType } = getCurrentGmNodeContext(textBeforeCursor);
    const existingProperties = getExistingCustomProperties(text, offset);
    const addIfMissing = (item: CompletionItem): void => {
      if (!existingProperties.has(item.label)) {
        completionItems.push(item);
      }
    };
    
    if (nodeType === 'Goal') {
      // Add goal properties
      if (!goalType || goalType === 'achieve') {
        addIfMissing({
          label: 'GoalType',
          kind: CompletionItemKind.Property,
          insertText: '"GoalType": "${1:Achieve}"',
          insertTextFormat: 2,
          documentation: 'Goal type (Achieve, Query, or Perform)'
        });
        addIfMissing({
          label: 'AchieveCondition',
          kind: CompletionItemKind.Property,
          insertText: '"AchieveCondition": "${1:}"',
          insertTextFormat: 2,
          documentation: 'Condition for Achieve goals'
        });
        addIfMissing({
          label: 'Group',
          kind: CompletionItemKind.Property,
          insertText: '"Group": ${1:true}',
          insertTextFormat: 2,
          documentation: 'Group property for Achieve goals'
        });
        addIfMissing({
          label: 'Divisible',
          kind: CompletionItemKind.Property,
          insertText: '"Divisible": ${1:false}',
          insertTextFormat: 2,
          documentation: 'Divisible property for Achieve goals'
        });
      }
      
      if (!goalType || goalType === 'query') {
        addIfMissing({
          label: 'QueriedProperty',
          kind: CompletionItemKind.Property,
          insertText: '"QueriedProperty": "${1:}"',
          insertTextFormat: 2,
          documentation: 'Queried property for Query goals'
        });
      }
      
      // Properties available to all goals
      addIfMissing({
        label: 'Controls',
        kind: CompletionItemKind.Property,
        insertText: '"Controls": "${1:}"',
        insertTextFormat: 2,
        documentation: 'Controls for goals'
      });
      addIfMissing({
        label: 'Monitors',
        kind: CompletionItemKind.Property,
        insertText: '"Monitors": "${1:}"',
        insertTextFormat: 2,
        documentation: 'Monitors for goals'
      });
    } else if (nodeType === 'Task') {
      // Add task properties
      addIfMissing({
        label: 'Params',
        kind: CompletionItemKind.Property,
        insertText: '"Params": "${1:}"',
        insertTextFormat: 2,
        documentation: 'Task parameters'
      });
      addIfMissing({
        label: 'Location',
        kind: CompletionItemKind.Property,
        insertText: '"Location": "${1:}"',
        insertTextFormat: 2,
        documentation: 'Task location'
      });
      addIfMissing({
        label: 'RobotNumber',
        kind: CompletionItemKind.Property,
        insertText: '"RobotNumber": ${1:1}',
        insertTextFormat: 2,
        documentation: 'Number of robots for task'
      });
    }
    
    // Description is available for all
    addIfMissing({
      label: 'Description',
      kind: CompletionItemKind.Property,
      insertText: '"Description": "${1:}"',
      insertTextFormat: 2,
      documentation: 'Node description'
    });
  }
  
  return completionItems;
}

export function getCompletionItems(
  doc: TextDocument,
  position: Position,
  variableDefinitions: Map<string, VariableInfo>
): CompletionItem[] {
  const completionItems: CompletionItem[] = [];
  
  // Add variable completions
  Array.from(variableDefinitions.keys()).forEach((name, i) => {
    completionItems.push({
      label: name,
      kind: CompletionItemKind.Variable,
      data: i
    });
  });

  const { context, goalType } = detectContextFromDocument(doc.getText(), position.line);
  
  if (context) {
    // Add flow step completions based on current context
    for (const [stepName, validContexts] of Object.entries(flowStepContextMap)) {
      let isValidForContext = false;
      
      // Check if flow step is valid for current context
      if (goalType) {
        // If we have a specific goal type (achieve/query), use that for validation
        isValidForContext = validContexts.includes(goalType);
      } else {
        // Fall back to general context (goal/task)
        isValidForContext = validContexts.includes(context);
      }
      
      if (isValidForContext) {
        const flowStep = flow[stepName];
        if (flowStep) {
          completionItems.push({
            label: stepName,
            kind: CompletionItemKind.Function,
            detail: flowStep.message,
            documentation: `Flow step: ${flowStep.message} (Valid in ${goalType || context} context)`,
            data: completionItems.length
          });
        }
      }
    }
    
    // Add goal type specific completions
    if (context === 'goal' && !goalType) {
      // If we're in a goal context but no goal type defined yet, suggest goal types
      const goalTypes = ['Achieve', 'Query', 'Perform'];
      goalTypes.forEach(type => {
        completionItems.push({
          label: type,
          kind: CompletionItemKind.EnumMember,
          detail: `Goal Type: ${type}`,
          documentation: `Sets the goal type to ${type}`,
          data: completionItems.length
        });
      });
    }
  }

  return completionItems;
}

connection.onCompletion((params): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return [];
  }

  // Check if this is a .gm file
  if (doc.uri.endsWith('.gm')) {
    return getGmCompletionItems(doc, params.position);
  }

  return getCompletionItems(doc, params.position, variableDefinitions);
});

// Resolve additional information for completion items (prevents error messages)
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onDefinition((params: DefinitionParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {return null;}

  const pos = params.position;
  const wordRange = getWordRangeAtPosition(doc, pos);
  if (!wordRange) {return null;}

  const word = doc.getText(wordRange);
  const info = variableDefinitions.get(word);

  return info ? info.location : null;
});

connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {return [];}

  const symbols: SymbolInformation[] = [];
  const text = doc.getText();
  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const match = line.match(/^([a-zA-Z_]\w*)\s*=/);
    if (match) {
      const varName = match[1];
      symbols.push({
        name: varName,
        kind: SymbolKind.Variable,
        location: {
          uri: doc.uri,
          range: Range.create(
            Position.create(lineIndex, 0),
            Position.create(lineIndex, varName.length)
          )
        }
      });
    }
  }

  return symbols;
});


export function getHover(
  doc: TextDocument,
  position: Position,
  variableDefinitions: Map<string, VariableInfo>
): Hover | null {
  const wordRange = getWordRangeAtPosition(doc, position);
  if (!wordRange) {
    return null;
  }

  const word = doc.getText(wordRange);
  
  // Check if it's a variable definition
  const info = variableDefinitions.get(word);
  if (info) {
    const contents = {
      kind: MarkupKind.Markdown,
      value: `\`${word} = ${info.value ?? '??'}\`\n\n**Defined in** [${info.location.uri.split('/').pop()}](${info.location.uri})`
    };
    return { contents };
  }

  // Check if it's a flow property
  const validContexts = propertyContextMap[word];
  if (validContexts) {
    const { context, goalType } = detectContextFromDocument(doc.getText(), position.line);
    const isValidInCurrentContext = validContexts.includes(context) || 
                                   (goalType && validContexts.includes(goalType));
    
    const contextInfo = context ? `\n\n**Current context:** ${context}${goalType ? ` (${goalType})` : ''}` : '';
    const validityInfo = context ? (isValidInCurrentContext ? ' ✅' : ' ❌') : '';
    
    const contents = {
      kind: MarkupKind.Markdown,
      value: `**Property:** \`${word}\`${validityInfo}\n\n**Valid contexts:** ${validContexts.join(', ')}${contextInfo}`
    };
    return { contents };
  }

  // Check if it's a flow step name
  const flowStepContexts = flowStepContextMap[word];
  if (flowStepContexts) {
    const { context, goalType } = detectContextFromDocument(doc.getText(), position.line);
    let isValidInCurrentContext = false;
    
    if (goalType) {
      isValidInCurrentContext = flowStepContexts.includes(goalType);
    } else {
      isValidInCurrentContext = flowStepContexts.includes(context);
    }
    
    const contextInfo = context ? `\n\n**Current context:** ${context}${goalType ? ` (${goalType})` : ''}` : '';
    const validityInfo = context ? (isValidInCurrentContext ? ' ✅' : ' ❌') : '';
    
    const flowStep = flow[word];
    const stepMessage = flowStep ? flowStep.message : 'Unknown flow step';
    
    const contents = {
      kind: MarkupKind.Markdown,
      value: `**Flow Step:** \`${word}\`${validityInfo}\n\n**Message:** ${stepMessage}\n\n**Valid contexts:** ${flowStepContexts.join(', ')}${contextInfo}`
    };
    return { contents };
  }

  // Check if it's a flow step
  const flowStep = flow[word];
  if (flowStep) {
    const metadataType = flowStep.metadata?.type || 'unknown';
    const contents = {
      kind: MarkupKind.Markdown,
      value: `**Flow Step:** \`${word}\`\n\n**Message:** ${flowStep.message}\n\n**Type:** ${metadataType}\n\n**Options:** ${flowStep.options.length > 0 ? flowStep.options.map(opt => opt.label).join(', ') : 'None'}`
    };
    return { contents };
  }

  return null;
}

connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }

  return getHover(doc, params.position, variableDefinitions);
});


export function getWordRangeAtPosition(doc: TextDocument, pos: Position): Range | null {
  const text = doc.getText();
  const offset = doc.offsetAt(pos);
  const start = findWordStart(text, offset);
  const end = findWordEnd(text, offset);
  if (start < 0 || end < 0) {return null;}
  return Range.create(doc.positionAt(start), doc.positionAt(end));
}

function findWordStart(text: string, offset: number): number {
  while (offset > 0 && /\w/.test(text[offset - 1])) {
    offset--;
  }
  return offset;
}

function findWordEnd(text: string, offset: number): number {
  while (offset < text.length && /\w/.test(text[offset])) {
    offset++;
  }
  return offset;
}

documents.listen(connection);
connection.listen();

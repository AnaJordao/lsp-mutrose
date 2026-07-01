import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { ANTLRErrorListener } from 'antlr4ts/ANTLRErrorListener';
import { RecognitionException } from 'antlr4ts/RecognitionException';
import { Recognizer } from 'antlr4ts/Recognizer';
import { Token } from 'antlr4ts/Token';
import { LexerATNSimulator } from 'antlr4ts/atn/LexerATNSimulator';
import { ParserATNSimulator } from 'antlr4ts/atn/ParserATNSimulator';
import { OCLLexer } from '../generated/OCLLexer';
import { OCLParser, AchieveConditionContext, QueriedPropertyContext } from '../generated/OCLParser';

interface OclErrorCollector<T> extends ANTLRErrorListener<T> {
  errors: string[];
}

function createLexerErrorListener(): OclErrorCollector<number> {
  const listener: OclErrorCollector<number> = {
    errors: [],
    syntaxError<T extends number>(
      _recognizer: Recognizer<T, LexerATNSimulator>,
      _offendingSymbol: T | undefined,
      _line: number,
      _charPositionInLine: number,
      msg: string,
      _e: RecognitionException | undefined
    ): void {
      this.errors.push(msg);
    }
  };

  return listener;
}

function createParserErrorListener(): OclErrorCollector<Token> {
  const listener: OclErrorCollector<Token> = {
    errors: [],
    syntaxError<T extends Token>(
      _recognizer: Recognizer<T, ParserATNSimulator>,
      _offendingSymbol: T | undefined,
      _line: number,
      _charPositionInLine: number,
      msg: string,
      _e: RecognitionException | undefined
    ): void {
      this.errors.push(msg);
    }
  };

  return listener;
}

function parseOcl<T>(input: string, parseFn: (parser: OCLParser) => T): { tree: T; errors: string[] } {
  const lexer = new OCLLexer(CharStreams.fromString(input));
  const lexerErrorListener = createLexerErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrorListener);

  const tokenStream = new CommonTokenStream(lexer);
  const parser = new OCLParser(tokenStream);
  const parserErrorListener = createParserErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrorListener);

  const tree = parseFn(parser);
  return {
    tree,
    errors: [...lexerErrorListener.errors, ...parserErrorListener.errors]
  };
}

function getCollectionRefName(text: string): string {
  return text.replace(/\s+/g, '');
}

function parseVariablesList(varsList: string): string[] {
  if (!varsList || varsList.trim() === '') {
    return [];
  }

  return varsList
    .split(',')
    .map(v => {
      const colonIndex = v.indexOf(':');
      if (colonIndex > 0) {
        return v.substring(0, colonIndex).trim();
      }
      return v.trim();
    })
    .filter(v => v.length > 0);
}

function normalizeTypeName(typeName: string): string {
  const trimmed = typeName.trim();
  const sequenceMatch = trimmed.match(/^Sequence\(([^)]+)\)$/i);
  const unwrapped = sequenceMatch ? sequenceMatch[1].trim() : trimmed;
  const dotIndex = unwrapped.lastIndexOf('.');
  return dotIndex >= 0 ? unwrapped.substring(dotIndex + 1) : unwrapped;
}

function validateMemberAccessAgainstClass(
  expression: string,
  variableName: string,
  typeName: string | undefined,
  classAttributes?: Map<string, Set<string>>,
): string[] {
  const errors: string[] = [];
  if (!typeName || !classAttributes || classAttributes.size === 0) {
    return errors;
  }

  const normalizedType = normalizeTypeName(typeName);
  const knownAttributes = classAttributes.get(normalizedType);
  if (!knownAttributes || knownAttributes.size === 0) {
    return errors;
  }

  const accessRegex = new RegExp(`\\b${variableName}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g');
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = accessRegex.exec(expression)) !== null) {
    const attributeName = match[1];
    if (knownAttributes.has(attributeName) || seen.has(attributeName)) {
      continue;
    }

    seen.add(attributeName);
    errors.push(`Attribute '${attributeName}' does not belong to class '${normalizedType}'.`);
  }

  return errors;
}

export function validateQueriedProperty(value: string, classAttributes?: Map<string, Set<string>>): string[] {
  const errors: string[] = [];

  if (!value || value.trim() === '') {
    return errors;
  }

  const trimmed = value.trim();
  // Check if the structure is correct
  const parsed = parseOcl<QueriedPropertyContext>(trimmed, parser => parser.queriedProperty());

  const collectionText = parsed.tree.collectionRef()?.text ?? '';
  const identText = parsed.tree.IDENT()?.text ?? '';

	// only allow semantic checks if the structure is correct enough to extract collectionRef and IDENT, otherwise return generic syntax error
  if (parsed.errors.length > 0) {
  
    const extraneousMatch = parsed.errors
      .map(e => e.match(/extraneous input '([^']+)' expecting IDENT/i))
      .find(m => !!m) as RegExpMatchArray | undefined;

    if (extraneousMatch) {
      const declMatch = trimmed.match(/select\s*\(\s*([^:]+)\s*:/i);
      const declaredVar = declMatch ? declMatch[1].trim() : undefined;
      if (declaredVar && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(declaredVar)) {
        errors.push(`Invalid Query Variable '${declaredVar}': must start with a letter or underscore and contain only letters, digits, or underscores.`);
        return errors;
      }
      // If we couldn't extract a declared var, fall through to generic error.
    } else {
      errors.push(`QueriedProperty must follow OCL select syntax: queriedVar->select(queryVar : type | condition)`);
      return errors;
    }
  }

  if (!collectionText || !identText) {
    errors.push(`QueriedProperty must follow OCL select syntax: queriedVar->select(queryVar : type | condition)`);
    return errors;
  }

  const queriedVar = getCollectionRefName(collectionText);
  const queryVar = identText;
  const queryVarType = parsed.tree.typeRef()?.text?.trim();

	// checks if the parser actually produced the collectionRef and IDENT nodes before it runs normal semantic checks
  if (queriedVar !== 'world_db' && !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(queriedVar)) {
    errors.push(`Invalid Queried Variable '${queriedVar}': must be 'world_db' or a valid identifier (start with a letter or underscore; may contain letters, digits, underscores, or dots).`);
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(queryVar)) {
    errors.push(`Invalid Query Variable '${queryVar}': must start with a letter or underscore and contain only letters, digits, or underscores.`);
  }

  errors.push(...validateMemberAccessAgainstClass(trimmed, queryVar, queryVarType, classAttributes));

  return errors;
}

export function validateAchieveCondition(
  value: string,
  monitorVars: string,
  controlVars: string,
  classAttributes?: Map<string, Set<string>>,
): string[] {
  const errors: string[] = [];

  if (!value || value.trim() === '') {
    return errors;
  }

  const trimmed = value.trim();
  const parsed = parseOcl<AchieveConditionContext>(trimmed, parser => parser.achieveCondition());

  const forAll = parsed.tree.forAllExpr();
  if (forAll) {
    // ANTLR can recover and still return a `forAllExpr` context even when the
    // input is structurally incomplete. Read the child nodes defensively so we
    // can convert those parser errors into a user-facing syntax diagnostic
    // instead of throwing while trying to inspect the tree.
    const collectionText = (() => {
      try {
        return forAll.collectionRef().text.trim();
      } catch {
        return '';
      }
    })();

    const iteratorText = (() => {
      try {
        return forAll.IDENT().text.trim();
      } catch {
        return '';
      }
    })();

    const hasCollectionText = collectionText !== '' && !collectionText.startsWith('<missing');
    const hasIteratorText = iteratorText !== '' && !iteratorText.startsWith('<missing');

    // ANTLR can report a trailing-expression error for `forAll(table|)` (for example) even
    // though the iterator and collection are present. Only reject the case
    // when the parser actually failed to produce one of the required nodes.
    if (!hasCollectionText || !hasIteratorText) {
      errors.push(`Invalid achieve condition format '${value}'. Allowed: simple boolean condition or collection->forAll(iterator[:Type] | condition)`);
      return errors;
    }

    const iteratedVar = getCollectionRefName(collectionText);
    const iterationVar = iteratorText;
    const iterationType = (() => {
      try {
        return forAll.typeRef()?.text?.trim();
      } catch {
        return undefined;
      }
    })();

    const monitorVarsList = parseVariablesList(monitorVars);
    if (!monitorVarsList.some(v => v === iteratedVar)) {
      errors.push(`Iterated Variable '${iteratedVar}' must be declared in Monitors property`);
    }

    const controlVarsList = parseVariablesList(controlVars);
    if (!controlVarsList.some(v => v === iterationVar)) {
      errors.push(`Iteration Variable '${iterationVar}' must be declared in Controls property`);
    }

    errors.push(...validateMemberAccessAgainstClass(trimmed, iterationVar, iterationType, classAttributes));

    return errors;
  }

  if (parsed.errors.length > 0) {
    errors.push(`Invalid achieve condition format '${value}'. Allowed: simple boolean condition or collection->forAll(iterator[:Type] | condition)`);
    return errors;
  }

  return errors;
}
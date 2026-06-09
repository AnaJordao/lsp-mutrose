grammar OCL;

queriedProperty
    : collectionRef ARROW SELECT LPAREN IDENT (COLON typeRef)? PIPE boolExpr RPAREN EOF
    ;

achieveCondition
    : forAllExpr EOF
    | boolExpr EOF
    ;

forAllExpr
    : collectionRef ARROW FORALL LPAREN IDENT (COLON typeRef)? PIPE boolExpr RPAREN
    ;

collectionRef
    : IDENT (DOT IDENT)*
    ;

typeRef
    : IDENT (DOT IDENT)*
    ;

boolExpr
    : boolTerm (OR boolTerm)*
    ;

boolTerm
    : boolFactor (AND boolFactor)*
    ;

boolFactor
    : NOT boolFactor
    | LPAREN boolExpr RPAREN
    | predicate
    ;

predicate
    : operand comparator operand
    | operand IN operand
    | operand
    ;

operand
    : IDENT (DOT IDENT)*
    | NUMBER
    | STRING
    ;

comparator
    : EQ
    | NEQ
    | GT
    | LT
    | GTE
    | LTE
    ;

ARROW  : '->';
SELECT : 'select';
FORALL : 'forAll';
IN     : 'in';
AND    : '&&';
OR     : '||';
NOT    : '!';
EQ     : '=';
NEQ    : '<>';
GTE    : '>=';
LTE    : '<=';
GT     : '>';
LT     : '<';
LPAREN : '(';
RPAREN : ')';
PIPE   : '|';
COLON  : ':';
DOT    : '.';

IDENT  : [a-zA-Z_] [a-zA-Z0-9_]*;
NUMBER : [0-9]+ ('.' [0-9]+)?;
STRING : '"' (~["\\\r\n] | '\\' .)* '"';

WS : [ \t\r\n]+ -> skip;

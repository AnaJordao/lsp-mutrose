// Generated from src/grammar/OCL.g4 by ANTLR 4.9.0-SNAPSHOT


import { ATN } from "antlr4ts/atn/ATN";
import { ATNDeserializer } from "antlr4ts/atn/ATNDeserializer";
import { FailedPredicateException } from "antlr4ts/FailedPredicateException";
import { NotNull } from "antlr4ts/Decorators";
import { NoViableAltException } from "antlr4ts/NoViableAltException";
import { Override } from "antlr4ts/Decorators";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParserATNSimulator } from "antlr4ts/atn/ParserATNSimulator";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { RuleContext } from "antlr4ts/RuleContext";
//import { RuleVersion } from "antlr4ts/RuleVersion";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Token } from "antlr4ts/Token";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { VocabularyImpl } from "antlr4ts/VocabularyImpl";

import * as Utils from "antlr4ts/misc/Utils";

import { OCLVisitor } from "./OCLVisitor";


export class OCLParser extends Parser {
	public static readonly ARROW = 1;
	public static readonly SELECT = 2;
	public static readonly FORALL = 3;
	public static readonly IN = 4;
	public static readonly AND = 5;
	public static readonly OR = 6;
	public static readonly NOT = 7;
	public static readonly EQ = 8;
	public static readonly NEQ = 9;
	public static readonly GTE = 10;
	public static readonly LTE = 11;
	public static readonly GT = 12;
	public static readonly LT = 13;
	public static readonly LPAREN = 14;
	public static readonly RPAREN = 15;
	public static readonly PIPE = 16;
	public static readonly COLON = 17;
	public static readonly DOT = 18;
	public static readonly IDENT = 19;
	public static readonly NUMBER = 20;
	public static readonly STRING = 21;
	public static readonly WS = 22;
	public static readonly RULE_queriedProperty = 0;
	public static readonly RULE_achieveCondition = 1;
	public static readonly RULE_forAllExpr = 2;
	public static readonly RULE_collectionRef = 3;
	public static readonly RULE_typeRef = 4;
	public static readonly RULE_boolExpr = 5;
	public static readonly RULE_boolTerm = 6;
	public static readonly RULE_boolFactor = 7;
	public static readonly RULE_predicate = 8;
	public static readonly RULE_operand = 9;
	public static readonly RULE_comparator = 10;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"queriedProperty", "achieveCondition", "forAllExpr", "collectionRef", 
		"typeRef", "boolExpr", "boolTerm", "boolFactor", "predicate", "operand", 
		"comparator",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, "'->'", "'select'", "'forAll'", "'in'", "'&&'", "'||'", "'!'", 
		"'='", "'<>'", "'>='", "'<='", "'>'", "'<'", "'('", "')'", "'|'", "':'", 
		"'.'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "ARROW", "SELECT", "FORALL", "IN", "AND", "OR", "NOT", "EQ", 
		"NEQ", "GTE", "LTE", "GT", "LT", "LPAREN", "RPAREN", "PIPE", "COLON", 
		"DOT", "IDENT", "NUMBER", "STRING", "WS",
	];
	public static readonly VOCABULARY: Vocabulary = new VocabularyImpl(OCLParser._LITERAL_NAMES, OCLParser._SYMBOLIC_NAMES, []);

	// @Override
	// @NotNull
	public get vocabulary(): Vocabulary {
		return OCLParser.VOCABULARY;
	}
	// tslint:enable:no-trailing-whitespace

	// @Override
	public get grammarFileName(): string { return "OCL.g4"; }

	// @Override
	public get ruleNames(): string[] { return OCLParser.ruleNames; }

	// @Override
	public get serializedATN(): string { return OCLParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(OCLParser._ATN, this);
	}
	// @RuleVersion(0)
	public queriedProperty(): QueriedPropertyContext {
		let _localctx: QueriedPropertyContext = new QueriedPropertyContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, OCLParser.RULE_queriedProperty);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 22;
			this.collectionRef();
			this.state = 23;
			this.match(OCLParser.ARROW);
			this.state = 24;
			this.match(OCLParser.SELECT);
			this.state = 25;
			this.match(OCLParser.LPAREN);
			this.state = 26;
			this.match(OCLParser.IDENT);
			this.state = 29;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === OCLParser.COLON) {
				{
				this.state = 27;
				this.match(OCLParser.COLON);
				this.state = 28;
				this.typeRef();
				}
			}

			this.state = 31;
			this.match(OCLParser.PIPE);
			this.state = 32;
			this.boolExpr();
			this.state = 33;
			this.match(OCLParser.RPAREN);
			this.state = 34;
			this.match(OCLParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public achieveCondition(): AchieveConditionContext {
		let _localctx: AchieveConditionContext = new AchieveConditionContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, OCLParser.RULE_achieveCondition);
		try {
			this.state = 42;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 36;
				this.forAllExpr();
				this.state = 37;
				this.match(OCLParser.EOF);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 39;
				this.boolExpr();
				this.state = 40;
				this.match(OCLParser.EOF);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public forAllExpr(): ForAllExprContext {
		let _localctx: ForAllExprContext = new ForAllExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, OCLParser.RULE_forAllExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 44;
			this.collectionRef();
			this.state = 45;
			this.match(OCLParser.ARROW);
			this.state = 46;
			this.match(OCLParser.FORALL);
			this.state = 47;
			this.match(OCLParser.LPAREN);
			this.state = 48;
			this.match(OCLParser.IDENT);
			this.state = 51;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === OCLParser.COLON) {
				{
				this.state = 49;
				this.match(OCLParser.COLON);
				this.state = 50;
				this.typeRef();
				}
			}

			this.state = 53;
			this.match(OCLParser.PIPE);
			this.state = 54;
			this.boolExpr();
			this.state = 55;
			this.match(OCLParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public collectionRef(): CollectionRefContext {
		let _localctx: CollectionRefContext = new CollectionRefContext(this._ctx, this.state);
		this.enterRule(_localctx, 6, OCLParser.RULE_collectionRef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 57;
			this.match(OCLParser.IDENT);
			this.state = 62;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === OCLParser.DOT) {
				{
				{
				this.state = 58;
				this.match(OCLParser.DOT);
				this.state = 59;
				this.match(OCLParser.IDENT);
				}
				}
				this.state = 64;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public typeRef(): TypeRefContext {
		let _localctx: TypeRefContext = new TypeRefContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, OCLParser.RULE_typeRef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 65;
			this.match(OCLParser.IDENT);
			this.state = 70;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === OCLParser.DOT) {
				{
				{
				this.state = 66;
				this.match(OCLParser.DOT);
				this.state = 67;
				this.match(OCLParser.IDENT);
				}
				}
				this.state = 72;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public boolExpr(): BoolExprContext {
		let _localctx: BoolExprContext = new BoolExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, OCLParser.RULE_boolExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 73;
			this.boolTerm();
			this.state = 78;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === OCLParser.OR) {
				{
				{
				this.state = 74;
				this.match(OCLParser.OR);
				this.state = 75;
				this.boolTerm();
				}
				}
				this.state = 80;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public boolTerm(): BoolTermContext {
		let _localctx: BoolTermContext = new BoolTermContext(this._ctx, this.state);
		this.enterRule(_localctx, 12, OCLParser.RULE_boolTerm);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 81;
			this.boolFactor();
			this.state = 86;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === OCLParser.AND) {
				{
				{
				this.state = 82;
				this.match(OCLParser.AND);
				this.state = 83;
				this.boolFactor();
				}
				}
				this.state = 88;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public boolFactor(): BoolFactorContext {
		let _localctx: BoolFactorContext = new BoolFactorContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, OCLParser.RULE_boolFactor);
		try {
			this.state = 96;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case OCLParser.NOT:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 89;
				this.match(OCLParser.NOT);
				this.state = 90;
				this.boolFactor();
				}
				break;
			case OCLParser.LPAREN:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 91;
				this.match(OCLParser.LPAREN);
				this.state = 92;
				this.boolExpr();
				this.state = 93;
				this.match(OCLParser.RPAREN);
				}
				break;
			case OCLParser.IDENT:
			case OCLParser.NUMBER:
			case OCLParser.STRING:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 95;
				this.predicate();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public predicate(): PredicateContext {
		let _localctx: PredicateContext = new PredicateContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, OCLParser.RULE_predicate);
		try {
			this.state = 107;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 8, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 98;
				this.operand();
				this.state = 99;
				this.comparator();
				this.state = 100;
				this.operand();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 102;
				this.operand();
				this.state = 103;
				this.match(OCLParser.IN);
				this.state = 104;
				this.operand();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 106;
				this.operand();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public operand(): OperandContext {
		let _localctx: OperandContext = new OperandContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, OCLParser.RULE_operand);
		let _la: number;
		try {
			this.state = 119;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case OCLParser.IDENT:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 109;
				this.match(OCLParser.IDENT);
				this.state = 114;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === OCLParser.DOT) {
					{
					{
					this.state = 110;
					this.match(OCLParser.DOT);
					this.state = 111;
					this.match(OCLParser.IDENT);
					}
					}
					this.state = 116;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case OCLParser.NUMBER:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 117;
				this.match(OCLParser.NUMBER);
				}
				break;
			case OCLParser.STRING:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 118;
				this.match(OCLParser.STRING);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public comparator(): ComparatorContext {
		let _localctx: ComparatorContext = new ComparatorContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, OCLParser.RULE_comparator);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 121;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << OCLParser.EQ) | (1 << OCLParser.NEQ) | (1 << OCLParser.GTE) | (1 << OCLParser.LTE) | (1 << OCLParser.GT) | (1 << OCLParser.LT))) !== 0))) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public static readonly _serializedATN: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\x18~\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x03\x02\x03\x02" +
		"\x03\x02\x03\x02\x03\x02\x03\x02\x03\x02\x05\x02 \n\x02\x03\x02\x03\x02" +
		"\x03\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x05\x03-\n\x03\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x05\x046\n\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x05\x03\x05\x03\x05" +
		"\x07\x05?\n\x05\f\x05\x0E\x05B\v\x05\x03\x06\x03\x06\x03\x06\x07\x06G" +
		"\n\x06\f\x06\x0E\x06J\v\x06\x03\x07\x03\x07\x03\x07\x07\x07O\n\x07\f\x07" +
		"\x0E\x07R\v\x07\x03\b\x03\b\x03\b\x07\bW\n\b\f\b\x0E\bZ\v\b\x03\t\x03" +
		"\t\x03\t\x03\t\x03\t\x03\t\x03\t\x05\tc\n\t\x03\n\x03\n\x03\n\x03\n\x03" +
		"\n\x03\n\x03\n\x03\n\x03\n\x05\nn\n\n\x03\v\x03\v\x03\v\x07\vs\n\v\f\v" +
		"\x0E\vv\v\v\x03\v\x03\v\x05\vz\n\v\x03\f\x03\f\x03\f\x02\x02\x02\r\x02" +
		"\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02\x14\x02" +
		"\x16\x02\x02\x03\x03\x02\n\x0F\x02\x80\x02\x18\x03\x02\x02\x02\x04,\x03" +
		"\x02\x02\x02\x06.\x03\x02\x02\x02\b;\x03\x02\x02\x02\nC\x03\x02\x02\x02" +
		"\fK\x03\x02\x02\x02\x0ES\x03\x02\x02\x02\x10b\x03\x02\x02\x02\x12m\x03" +
		"\x02\x02\x02\x14y\x03\x02\x02\x02\x16{\x03\x02\x02\x02\x18\x19\x05\b\x05" +
		"\x02\x19\x1A\x07\x03\x02\x02\x1A\x1B\x07\x04\x02\x02\x1B\x1C\x07\x10\x02" +
		"\x02\x1C\x1F\x07\x15\x02\x02\x1D\x1E\x07\x13\x02\x02\x1E \x05\n\x06\x02" +
		"\x1F\x1D\x03\x02\x02\x02\x1F \x03\x02\x02\x02 !\x03\x02\x02\x02!\"\x07" +
		"\x12\x02\x02\"#\x05\f\x07\x02#$\x07\x11\x02\x02$%\x07\x02\x02\x03%\x03" +
		"\x03\x02\x02\x02&\'\x05\x06\x04\x02\'(\x07\x02\x02\x03(-\x03\x02\x02\x02" +
		")*\x05\f\x07\x02*+\x07\x02\x02\x03+-\x03\x02\x02\x02,&\x03\x02\x02\x02" +
		",)\x03\x02\x02\x02-\x05\x03\x02\x02\x02./\x05\b\x05\x02/0\x07\x03\x02" +
		"\x0201\x07\x05\x02\x0212\x07\x10\x02\x0225\x07\x15\x02\x0234\x07\x13\x02" +
		"\x0246\x05\n\x06\x0253\x03\x02\x02\x0256\x03\x02\x02\x0267\x03\x02\x02" +
		"\x0278\x07\x12\x02\x0289\x05\f\x07\x029:\x07\x11\x02\x02:\x07\x03\x02" +
		"\x02\x02;@\x07\x15\x02\x02<=\x07\x14\x02\x02=?\x07\x15\x02\x02><\x03\x02" +
		"\x02\x02?B\x03\x02\x02\x02@>\x03\x02\x02\x02@A\x03\x02\x02\x02A\t\x03" +
		"\x02\x02\x02B@\x03\x02\x02\x02CH\x07\x15\x02\x02DE\x07\x14\x02\x02EG\x07" +
		"\x15\x02\x02FD\x03\x02\x02\x02GJ\x03\x02\x02\x02HF\x03\x02\x02\x02HI\x03" +
		"\x02\x02\x02I\v\x03\x02\x02\x02JH\x03\x02\x02\x02KP\x05\x0E\b\x02LM\x07" +
		"\b\x02\x02MO\x05\x0E\b\x02NL\x03\x02\x02\x02OR\x03\x02\x02\x02PN\x03\x02" +
		"\x02\x02PQ\x03\x02\x02\x02Q\r\x03\x02\x02\x02RP\x03\x02\x02\x02SX\x05" +
		"\x10\t\x02TU\x07\x07\x02\x02UW\x05\x10\t\x02VT\x03\x02\x02\x02WZ\x03\x02" +
		"\x02\x02XV\x03\x02\x02\x02XY\x03\x02\x02\x02Y\x0F\x03\x02\x02\x02ZX\x03" +
		"\x02\x02\x02[\\\x07\t\x02\x02\\c\x05\x10\t\x02]^\x07\x10\x02\x02^_\x05" +
		"\f\x07\x02_`\x07\x11\x02\x02`c\x03\x02\x02\x02ac\x05\x12\n\x02b[\x03\x02" +
		"\x02\x02b]\x03\x02\x02\x02ba\x03\x02\x02\x02c\x11\x03\x02\x02\x02de\x05" +
		"\x14\v\x02ef\x05\x16\f\x02fg\x05\x14\v\x02gn\x03\x02\x02\x02hi\x05\x14" +
		"\v\x02ij\x07\x06\x02\x02jk\x05\x14\v\x02kn\x03\x02\x02\x02ln\x05\x14\v" +
		"\x02md\x03\x02\x02\x02mh\x03\x02\x02\x02ml\x03\x02\x02\x02n\x13\x03\x02" +
		"\x02\x02ot\x07\x15\x02\x02pq\x07\x14\x02\x02qs\x07\x15\x02\x02rp\x03\x02" +
		"\x02\x02sv\x03\x02\x02\x02tr\x03\x02\x02\x02tu\x03\x02\x02\x02uz\x03\x02" +
		"\x02\x02vt\x03\x02\x02\x02wz\x07\x16\x02\x02xz\x07\x17\x02\x02yo\x03\x02" +
		"\x02\x02yw\x03\x02\x02\x02yx\x03\x02\x02\x02z\x15\x03\x02\x02\x02{|\t" +
		"\x02\x02\x02|\x17\x03\x02\x02\x02\r\x1F,5@HPXbmty";
	public static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!OCLParser.__ATN) {
			OCLParser.__ATN = new ATNDeserializer().deserialize(Utils.toCharArray(OCLParser._serializedATN));
		}

		return OCLParser.__ATN;
	}

}

export class QueriedPropertyContext extends ParserRuleContext {
	public collectionRef(): CollectionRefContext {
		return this.getRuleContext(0, CollectionRefContext);
	}
	public ARROW(): TerminalNode { return this.getToken(OCLParser.ARROW, 0); }
	public SELECT(): TerminalNode { return this.getToken(OCLParser.SELECT, 0); }
	public LPAREN(): TerminalNode { return this.getToken(OCLParser.LPAREN, 0); }
	public IDENT(): TerminalNode { return this.getToken(OCLParser.IDENT, 0); }
	public PIPE(): TerminalNode { return this.getToken(OCLParser.PIPE, 0); }
	public boolExpr(): BoolExprContext {
		return this.getRuleContext(0, BoolExprContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(OCLParser.RPAREN, 0); }
	public EOF(): TerminalNode { return this.getToken(OCLParser.EOF, 0); }
	public COLON(): TerminalNode | undefined { return this.tryGetToken(OCLParser.COLON, 0); }
	public typeRef(): TypeRefContext | undefined {
		return this.tryGetRuleContext(0, TypeRefContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_queriedProperty; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitQueriedProperty) {
			return visitor.visitQueriedProperty(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AchieveConditionContext extends ParserRuleContext {
	public forAllExpr(): ForAllExprContext | undefined {
		return this.tryGetRuleContext(0, ForAllExprContext);
	}
	public EOF(): TerminalNode { return this.getToken(OCLParser.EOF, 0); }
	public boolExpr(): BoolExprContext | undefined {
		return this.tryGetRuleContext(0, BoolExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_achieveCondition; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitAchieveCondition) {
			return visitor.visitAchieveCondition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForAllExprContext extends ParserRuleContext {
	public collectionRef(): CollectionRefContext {
		return this.getRuleContext(0, CollectionRefContext);
	}
	public ARROW(): TerminalNode { return this.getToken(OCLParser.ARROW, 0); }
	public FORALL(): TerminalNode { return this.getToken(OCLParser.FORALL, 0); }
	public LPAREN(): TerminalNode { return this.getToken(OCLParser.LPAREN, 0); }
	public IDENT(): TerminalNode { return this.getToken(OCLParser.IDENT, 0); }
	public PIPE(): TerminalNode { return this.getToken(OCLParser.PIPE, 0); }
	public boolExpr(): BoolExprContext {
		return this.getRuleContext(0, BoolExprContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(OCLParser.RPAREN, 0); }
	public COLON(): TerminalNode | undefined { return this.tryGetToken(OCLParser.COLON, 0); }
	public typeRef(): TypeRefContext | undefined {
		return this.tryGetRuleContext(0, TypeRefContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_forAllExpr; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitForAllExpr) {
			return visitor.visitForAllExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CollectionRefContext extends ParserRuleContext {
	public IDENT(): TerminalNode[];
	public IDENT(i: number): TerminalNode;
	public IDENT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.IDENT);
		} else {
			return this.getToken(OCLParser.IDENT, i);
		}
	}
	public DOT(): TerminalNode[];
	public DOT(i: number): TerminalNode;
	public DOT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.DOT);
		} else {
			return this.getToken(OCLParser.DOT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_collectionRef; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitCollectionRef) {
			return visitor.visitCollectionRef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeRefContext extends ParserRuleContext {
	public IDENT(): TerminalNode[];
	public IDENT(i: number): TerminalNode;
	public IDENT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.IDENT);
		} else {
			return this.getToken(OCLParser.IDENT, i);
		}
	}
	public DOT(): TerminalNode[];
	public DOT(i: number): TerminalNode;
	public DOT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.DOT);
		} else {
			return this.getToken(OCLParser.DOT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_typeRef; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitTypeRef) {
			return visitor.visitTypeRef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BoolExprContext extends ParserRuleContext {
	public boolTerm(): BoolTermContext[];
	public boolTerm(i: number): BoolTermContext;
	public boolTerm(i?: number): BoolTermContext | BoolTermContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BoolTermContext);
		} else {
			return this.getRuleContext(i, BoolTermContext);
		}
	}
	public OR(): TerminalNode[];
	public OR(i: number): TerminalNode;
	public OR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.OR);
		} else {
			return this.getToken(OCLParser.OR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_boolExpr; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitBoolExpr) {
			return visitor.visitBoolExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BoolTermContext extends ParserRuleContext {
	public boolFactor(): BoolFactorContext[];
	public boolFactor(i: number): BoolFactorContext;
	public boolFactor(i?: number): BoolFactorContext | BoolFactorContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BoolFactorContext);
		} else {
			return this.getRuleContext(i, BoolFactorContext);
		}
	}
	public AND(): TerminalNode[];
	public AND(i: number): TerminalNode;
	public AND(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.AND);
		} else {
			return this.getToken(OCLParser.AND, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_boolTerm; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitBoolTerm) {
			return visitor.visitBoolTerm(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BoolFactorContext extends ParserRuleContext {
	public NOT(): TerminalNode | undefined { return this.tryGetToken(OCLParser.NOT, 0); }
	public boolFactor(): BoolFactorContext | undefined {
		return this.tryGetRuleContext(0, BoolFactorContext);
	}
	public LPAREN(): TerminalNode | undefined { return this.tryGetToken(OCLParser.LPAREN, 0); }
	public boolExpr(): BoolExprContext | undefined {
		return this.tryGetRuleContext(0, BoolExprContext);
	}
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(OCLParser.RPAREN, 0); }
	public predicate(): PredicateContext | undefined {
		return this.tryGetRuleContext(0, PredicateContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_boolFactor; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitBoolFactor) {
			return visitor.visitBoolFactor(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PredicateContext extends ParserRuleContext {
	public operand(): OperandContext[];
	public operand(i: number): OperandContext;
	public operand(i?: number): OperandContext | OperandContext[] {
		if (i === undefined) {
			return this.getRuleContexts(OperandContext);
		} else {
			return this.getRuleContext(i, OperandContext);
		}
	}
	public comparator(): ComparatorContext | undefined {
		return this.tryGetRuleContext(0, ComparatorContext);
	}
	public IN(): TerminalNode | undefined { return this.tryGetToken(OCLParser.IN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_predicate; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitPredicate) {
			return visitor.visitPredicate(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class OperandContext extends ParserRuleContext {
	public IDENT(): TerminalNode[];
	public IDENT(i: number): TerminalNode;
	public IDENT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.IDENT);
		} else {
			return this.getToken(OCLParser.IDENT, i);
		}
	}
	public DOT(): TerminalNode[];
	public DOT(i: number): TerminalNode;
	public DOT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(OCLParser.DOT);
		} else {
			return this.getToken(OCLParser.DOT, i);
		}
	}
	public NUMBER(): TerminalNode | undefined { return this.tryGetToken(OCLParser.NUMBER, 0); }
	public STRING(): TerminalNode | undefined { return this.tryGetToken(OCLParser.STRING, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_operand; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitOperand) {
			return visitor.visitOperand(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ComparatorContext extends ParserRuleContext {
	public EQ(): TerminalNode | undefined { return this.tryGetToken(OCLParser.EQ, 0); }
	public NEQ(): TerminalNode | undefined { return this.tryGetToken(OCLParser.NEQ, 0); }
	public GT(): TerminalNode | undefined { return this.tryGetToken(OCLParser.GT, 0); }
	public LT(): TerminalNode | undefined { return this.tryGetToken(OCLParser.LT, 0); }
	public GTE(): TerminalNode | undefined { return this.tryGetToken(OCLParser.GTE, 0); }
	public LTE(): TerminalNode | undefined { return this.tryGetToken(OCLParser.LTE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return OCLParser.RULE_comparator; }
	// @Override
	public accept<Result>(visitor: OCLVisitor<Result>): Result {
		if (visitor.visitComparator) {
			return visitor.visitComparator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}



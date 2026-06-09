// Generated from src/grammar/OCL.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

import { QueriedPropertyContext } from "./OCLParser";
import { AchieveConditionContext } from "./OCLParser";
import { ForAllExprContext } from "./OCLParser";
import { CollectionRefContext } from "./OCLParser";
import { TypeRefContext } from "./OCLParser";
import { BoolExprContext } from "./OCLParser";
import { BoolTermContext } from "./OCLParser";
import { BoolFactorContext } from "./OCLParser";
import { PredicateContext } from "./OCLParser";
import { OperandContext } from "./OCLParser";
import { ComparatorContext } from "./OCLParser";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `OCLParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface OCLVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by `OCLParser.queriedProperty`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueriedProperty?: (ctx: QueriedPropertyContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.achieveCondition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAchieveCondition?: (ctx: AchieveConditionContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.forAllExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForAllExpr?: (ctx: ForAllExprContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.collectionRef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCollectionRef?: (ctx: CollectionRefContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.typeRef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeRef?: (ctx: TypeRefContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.boolExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBoolExpr?: (ctx: BoolExprContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.boolTerm`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBoolTerm?: (ctx: BoolTermContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.boolFactor`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBoolFactor?: (ctx: BoolFactorContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.predicate`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPredicate?: (ctx: PredicateContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.operand`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOperand?: (ctx: OperandContext) => Result;

	/**
	 * Visit a parse tree produced by `OCLParser.comparator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitComparator?: (ctx: ComparatorContext) => Result;
}


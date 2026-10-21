"use strict";
const acorn = require("acorn");
function walk(node, visit) {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc") continue;
    if (Array.isArray(value)) value.forEach(v => walk(v, visit));
    else if (value && typeof value.type === "string") walk(value, visit);
  }
}
function parse(source, handler = false, scriptOnly = false, moduleOnly = false) {
  const options = {ecmaVersion:"latest",locations:true,allowHashBang:true,allowReturnOutsideFunction:handler};
  if (moduleOnly) return acorn.parse(source,{...options,sourceType:"module"});
  try { return acorn.parse(source,{...options,sourceType:"script"}); }
  catch (scriptError) {
    if (handler || scriptOnly) throw scriptError;
    try { return acorn.parse(source,{...options,sourceType:"module"}); }
    catch (moduleError) { throw moduleError.pos > scriptError.pos ? moduleError : scriptError; }
  }
}
function literal(node) { return node && node.type === "Literal" && typeof node.value === "string" ? node.value : null; }
function member(node) {
  return node && node.type === "MemberExpression" ? (node.computed ? literal(node.property) : node.property.name) : null;
}
function names(pattern, result) {
  if (!pattern) return;
  if (pattern.type === "Identifier") result.add(pattern.name);
  else if (pattern.type === "RestElement") names(pattern.argument,result);
  else if (pattern.type === "AssignmentPattern") names(pattern.left,result);
  else if (pattern.type === "ArrayPattern") pattern.elements.forEach(p => names(p,result));
  else if (pattern.type === "ObjectPattern") pattern.properties.forEach(p => names(p.value || p.argument,result));
}
// Top-level declarations only: a nested helper must not satisfy a missing global API.
function declarations(ast) {
  const declared = new Set(), callable = new Set();
  for (const statement of ast.body) {
    const node = statement.declaration || statement;
    if (node.type === "FunctionDeclaration" && node.id) { declared.add(node.id.name); callable.add(node.id.name); }
    if (node.type === "VariableDeclaration") for (const d of node.declarations) {
      names(d.id,declared);
      if (d.id.type === "Identifier" && d.init && ["FunctionExpression","ArrowFunctionExpression"].includes(d.init.type)) callable.add(d.id.name);
    }
    if (node.type === "ClassDeclaration" && node.id) declared.add(node.id.name);
    if (node.type === "ImportDeclaration") node.specifiers.forEach(s => declared.add(s.local.name));
    if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
      const a = node.expression;
      if (a.left.type === "MemberExpression" && a.left.object.type === "Identifier" && ["window","globalThis"].includes(a.left.object.name) && member(a.left)) {
        declared.add(member(a.left));
        if (["FunctionExpression","ArrowFunctionExpression"].includes(a.right.type)) callable.add(member(a.left));
      }
    }
  }
  return {declared,callable};
}
function isRpc(node, factories) {
  if (!node) return false;
  if (node.type === "ChainExpression") return isRpc(node.expression,factories);
  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier" && factories.includes(node.callee.name)) return true;
    return ["withSuccessHandler","withFailureHandler","withUserObject"].includes(member(node.callee)) && isRpc(node.callee.object,factories);
  }
  return member(node) === "run" && member(node.object) === "script" && node.object.object.type === "Identifier" && node.object.object.name === "google";
}
function maskTemplates(source) {
  return source.replace(/<\?[\s\S]*?\?>/g, s => s.replace(/[^\r\n]/g," ").replace(/ /,"0"));
}
module.exports = {walk,parse,literal,member,declarations,isRpc,maskTemplates};

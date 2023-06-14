/**
 * unparse an AST
 * @param {type:string} ast 
 * @param {bool} doNewline 
 * @param {int} limit 
 * @param {int} indent 
 * @returns {string}
 */
export function unAST(ast,doNewline,limit,indent) {
    indent ??= 0;
    limit ??= 20;
    if(limit <= 0) return `...`;
    indent++;
    limit--;
    const doPadd = ()=>doNewline ? "\n"+(" ".repeat(indent)) : ""
    const astArrMap = a=>{
        
        const data = unAST(a,doNewline,limit,indent);
        return data;
    }
    switch(ast.type){
        case "value": {
            return JSON.stringify(ast.value);
        }
        case "call": {
            return `${doPadd()}${unAST(ast.head,doNewline,limit,indent)}(${doPadd()}${
                ast.body.map(astArrMap).join(", ")
            }${doPadd()})`
        }
        case "word": {
            return ast.value;
        }
        case "atWord": {
            return "@"+ast.value;
        }
        case "block": {
            return `${doPadd()}${doNewline ? "\n" : ""}(${
                ast.body.map(astArrMap).join(", ")
            }${doPadd()})`
        }
        case "assignment": {
            return `${unAST(ast.head,doNewline,limit,indent)} = (${
                ast.body.map(astArrMap).join(" <ASSN-SEP> ")
            })`
        }
        case "declaration": {
            return `${unAST(ast.head,doNewline,limit,indent)} := (${
                ast.body.map(astArrMap).join(" <DECL-SEP> ")
            })`
        }
        default: return `UnhandledAST:${JSON.stringify(ast)}`
    }
}
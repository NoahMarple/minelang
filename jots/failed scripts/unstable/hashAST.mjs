import Crypto from 'node:crypto'

// \n open construct
// \t construct entry
// \r close construct

/**
 * unparse an AST
 * @param {type:string} ast 
 * @param {bool} doNewline 
 * @param {int} limit 
 * @param {int} indent 
 * @returns {string}
 */
export function hashAST(ast,hash,debugging) {
    let isFinal = false
    if(!hash){
        hash = Crypto.createHash("sha256",{
            //options
        })
        isFinal = true;
    }

    const write = data=>{
        if(debugging) console.log(JSON.stringify(data));
        hash.update(data);
    }

    const type = ast.type ?? "untyped";
    write("\n"+JSON.stringify(type)+"\t");
    switch(type){
        case "value": {
            write(JSON.stringify(ast.value));
        }
        case "call": {
            hashAST(ast.head,hash,debugging);
            for (const part of ast.body) {
                hashAST(part,hash,debugging);
                write("\t");
            }
        }
        case "word": {
            write(JSON.stringify(ast.value));
        }
        case "atWord": {
            write(JSON.stringify(ast.value));
        }
        case "block": {
            for (const part of ast.body) {
                hashAST(part,hash,debugging);
                write("\t");
            }
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
    write("\r")
}
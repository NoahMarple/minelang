import { unAST } from "../src/unAST.mjs";
import { BiliValueVar } from "../src/engine-vars.mjs";

const installme = {
    ["debugger"](engine, astBlock,  assignTo) {
        debugger;
    },
    ["unAST"](engine, astBlock,  assignTo) {
        const a = {
            type:"block",
            body:astBlock.body
        }
        return new BiliValueVar(engine,"debugging-unAST()",unAST(a))
    },
    async ["list-taker"](engine, astBlock, assignTo) {
        const { body } = astBlock;

        const op = engine.newOP();
        op.push("print");
        const openVars = new Set();
        for (const ast of body) {
            let in0 = await engine.commonBlockHandle(ast, engine.VAR_WANTS_REG);
            openVars.add(in0)
            await in0.openRead();

            op.pushRead(in0);
        }

        op.place();

        for (const in0 of openVars) {
            await in0.closeRead();
        }



    },
    async ["simple-taker"](engine, astBlock, assignTo) {
        const { body } = astBlock;

        let in0 = await engine.commonBlockHandle(body[0], engine.VAR_WANTS_REG);


        await in0.openRead();

        const op = engine.newOP();
        op.push("simple-get");
        op.pushRead(in0);
        op.place();

        await in0.closeRead();



    },
    async ["simple-giver"](engine, astBlock, assignTo) {
        const { body } = astBlock;

        assignTo = engine.resolveWants(assignTo);

        await assignTo.openWrite();

        const op = engine.newOP();
        op.push("simple-set");
        op.pushWrite(assignTo);
        op.pushValue("hello");
        op.place();

        await assignTo.closeWrite();

        return assignTo;
    },
    ["cmp-dumpName"](engine, astBlock, assignTo) {
        console.log(...astBlock.body.forEach(e => e.name))
    },
    ["dump-scope"](engine, astBlock, assignTo) {
        let scope = engine.currentScope
        let build = [];
        build.push("[scope dump]")
        while(scope) {
            build.push(`(${scope.name}): ${[...scope.vars.keys()].join(", ")}`);
            scope = scope.parent;
        }
        return new BiliValueVar(engine,"debugging-dump-scope()",build.join("\n"));
    },
}

export function installBiliLib(engine) {
    for (const [k, v] of Object.entries(installme)) {
        const tok = engine.getVar(k, engine.currentScope.parent);
        if (tok.isInitlised) continue;
        tok.onExec = v;
        tok.isInitlised = true;
        tok.name = `${k}@corelib`
    }
}

export function returnBiliLib(engine) {
    return engine.VAR_NULL;
}
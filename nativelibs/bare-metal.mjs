import {unAST} from "../src/unAST.mjs";

const installme = {
    //TODO add return ability
    async ["asem"](engine, astBlock, assignTo) {
        assignTo = engine.resolveWants(assignTo);
        let usedReturn = false;
        const { body } = astBlock;
        let mode = null;
        const openReaders = new Set(), openWriters = new Set();
        const op = engine.newOP();
        for (const ast of body) {
            let prepOnly = false
            if (mode) {
                switch (mode) {
                    case "raw":
                        op.push(ast);
                        break;
                    case "word":
                        op.push(engine.getWordValue(ast))
                        break;
                    case "prep-getter":
                        prepOnly = true;
                    case "getter":
                        {
                            let varE = await engine.commonBlockHandle(ast, engine.VAR_WANTS_REG);
                            if (!openReaders.has(varE)) {
                                await varE.openRead();
                                openReaders.add(varE);
                            }
                            if(!prepOnly) op.pushRead(varE);
                        }
                        break;
                    case "prep-setter":
                        prepOnly = true;
                    case "setter":
                        {
                            let varE = await engine.commonBlockHandle(ast, engine.VAR_WANTS_REG);
                            if (!openWriters.has(varE)) {
                                await varE.openWrite();
                                openWriters.add(varE);
                            }
                            if(!prepOnly) op.pushWrite(varE);
                        }
                        break;
                    default: 
                        throw new Error("asem: unknown operation "+JSON.stringify(mode)+", argument: "+JSON.stringify(unAST(ast)));
                    continue;
                }
                mode = null
                continue;
            } else {
                mode = engine.getWordValue(ast);
                if(mode == "prep-return"){
                    mode = "return";
                    prepOnly = true;
                    continue;
                }
                if(mode == "return") {
                    usedReturn = true
                    if (!openWriters.has(assignTo)) {    
                        await assignTo.openWrite();
                        openWriters.add(assignTo);
                    }
                    if(!prepOnly) op.pushWrite(assignTo);
                    mode = null;
                    continue
                }
                if(mode == "assign") { //assignTo as setter, UNFINISHED
                    usedReturn = true
                    if (!openWriters.has(assignTo)) {    
                        await assignTo.openWrite();
                        openWriters.add(assignTo);
                    }
                    op.pushWrite(assignTo);
                    mode = null;
                    continue
                }
            }
        }
        if (mode) throw new Error(`asem: unfinished multi part ${JSON.stringify(mode)} statement ${JSON.stringify(mode)}`);
        op.place();
            for (const r of openReaders) await r.closeRead();
            for (const w of openWriters) await w.closeWrite();

        return usedReturn ? assignTo : engine.VAR_NULL;

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
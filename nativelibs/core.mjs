import { BiliRawVar, BiliGlobalzVar, BiliVar, BiliRegister } from "../src/engine-vars.mjs";


let globalzID = 0;

const installme = {
    async ["import"](engine,astBlock,assignTo){
        const {body} = astBlock;
        let out
        for (const word of body) {
            out = await useLib(engine.getWordValue(word),assignTo);
        }
        return out;
    },
    async ["do"](engine,astBlock,assignTo){
        const {body} = astBlock;
        let out;
        for (const childAST of body) {
           out = await engine.commonBlockHandle(childAST,assignTo);
        }
        return out ?? engine.VAR_NULL;
    },
    async ["void"](engine,astBlock,assignTo){ //returns null
        const {body} = astBlock;
        let out;
        for (const childAST of body) {
           await engine.commonBlockHandle(childAST,assignTo);
        }
        return engine.VAR_NULL;
    },
    async ["prepare"](engine,astBlock,assignTo){ //returns null
        const {body} = astBlock;
        let out;
        for (const childAST of body) {
           out = await engine.commonBlockHandle(childAST,assignTo);
           await out?.genaricPrepare();
        }
        return out ?? engine.VAR_NULL;
    },
    async ["var-raw"](engine,astBlock,assignTo){
        const {body: [word]} = astBlock;
        let newVar = new BiliRawVar(engine,engine.getWordValue(word));
        return await engine.assignToResolve(newVar,assignTo);
    },
    async ["reg"](engine,astBlock,assignTo){
        const {body} = astBlock;
        let [input] = body;
        let output = input ? await engine.commonBlockHandle(input,engine.VAR_WANTS_REG) : engine.newRegister();
        if(output instanceof BiliRegister) return output;
        
        let outReg = engine.newRegister();
        let op = engine.newOP();
        await outReg.openWrite();
        await output.openRead();
        op.push("set")
        op.pushWrite(outReg)
        op.pushRead(output)
        op.place()

        await outReg.closeWrite();
        await output.closeRead();

        return await engine.assignToResolve(outReg,assignTo);
    },
    async ["cmp-print"](engine,astBlock,assignTo){
        const {body} = astBlock;
        const build = [];
        for (const childAST of body) {
            const outcome = await engine.commonBlockHandle(childAST,engine.VAR_WANTS_REG);
            const staticVal = outcome.toStatic?.()
            build.push(staticVal !== undefined ? (staticVal.name ?? staticVal) : "dynamic("+outcome.name+")");
        }
        console.log("print:",...build)
    },

    //TODO: define a common "do" behavor and peg this func to that
    async ["parent-scope"](engine,astBlock,assignTo){ //acts apon parent scope in a new (child) scope
        assignTo = engine.resolveWants(assignTo);
        let out;
        const {body} = astBlock;
        const parent = engine.currentScope.parent;
        if(!parent) throw new Error(`parent-scope@corelib: attempt to access parent of top level scope`);

        engine.push("proxied-parent:"+parent.name);

        Object.assign(engine.currentScope,{
            vars:parent.vars, 
        })

        for (const childAST of body) {
            out = await engine.commonBlockHandle(childAST,assignTo);
        }

        engine.pop();
        return out;
    },
    async ["child-scope"](engine,astBlock,assignTo){ //acts apon parent scope in a new (child) scope
        assignTo = engine.resolveWants(assignTo);
        let out;
        const {body} = astBlock;

        engine.push("explicit child");

        for (const childAST of body) {
            out = await engine.commonBlockHandle(childAST,assignTo);
        }

        engine.pop();
        return out;
    },
    async ["unset"](engine,astBlock,assignTo){
        let out = new BiliVar(engine,"unset()");
        return await engine.assignToResolve(out,assignTo);
    },
    async ["globalz"](engine,astBlock,assignTo){
        const {body:[gzname]} = astBlock
        let name;
        if(gzname) {
            name = engine.getWordValue(gzname);
        } else {
            name = `_gz${globalzID++}`;
        }
        let out = new BiliGlobalzVar(engine,`globalz(${name})`,name);
        return await engine.assignToResolve(out,assignTo);
    },
}

export function installBiliLib(engine){

    for( const [k,v] of Object.entries(installme)){
        const tok = engine.getVar(k,engine.currentScope.parent);
        //if(tok.isInitlised) continue;
        tok.onExec = v;
        tok.isInitlised = true;
        tok.name = `${k}@corelib`
    }
}


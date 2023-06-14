//modules see the parent stack's imports too, dont use it for permissions

import { BiliValueVar, VAR_NULL, VAR_WANTS_REG } from "../src/engine-vars.mjs";
import { Flags,Flag } from "../src/flags.mjs";

function assertAdmin(engine,err){
    const {isAdmin} = engine.currentScope.context;
    if(isAdmin)return;
    else throw new Error(`blocked action: ${err}\npermission denied\nuse elevation tools\n or set 'policy-enforce' to false (NOT RECOMMENDED)`);
}

//same args as var constructor
function dataToSimple(engine,name,data){
    if(data == undefined)
        return new BiliValueVar(engine,name,engine.VAR_NULL);
    switch(typeof data){
        case "string":
        case "number":
        case "boolean": 
        return new BiliValueVar(engine,name,data);
    }
    //if we fail to map the data to a primitive, umm... send it out anyway? (temprary)
    //TODO: handle bad data
    return new BiliValueVar(engine,name,data);
}

async function assertToStatic(ast,argName,operation){
    const v = await engine.commonBlockHandle(ast,engine.VAR_NULL);
    if(!v.toStatic) throw new Error(`${operation}: '${argName}' argument must be static`);
    return v.toStatic();
}

const installme = {
    async ["cmp-flag-if"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-if"
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 2) throw new Error(`${opName}: expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(flagName,conditional)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        const val = Flags.get(key);
        let exec = engine.VAR_NULL
        if(val){
            let exec = engine.commonBlockHandle(body[1],engine.VAR_WANTS_REG);
        }
        return exec;
    },
    async ["js"](engine, astBlock, assignTo) {
        assertAdmin(engine,"running unsandboxed javascript");
    },
    async ["new-set"](engine,astBlock,assignTo){
        assertAdmin(engine,"creating javascript Set");
        const {body} = astBlock;
        let out = new Set();
        for (const childAST of body) {
            out.add( await assertToStatic(childAST) );
        }
        return dataToSimple(engine,"Set()",out);
    },
    async ["cmp-action"](engine,astBlock,assignTo){
        const opName = "cmp-action"
        assertAdmin(engine,"telling the compiler to preform an action");
        assignTo = engine.resolveWants(assignTo);
        const {body} = astBlock;
        if(body.length != 2) throw new Error(`${opName}: expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(action,argument)`);
        
        let act = await assertToStatic(body[0],"act",opName)
        let arg = await assertToStatic(body[1],"arg",opName)

        const result = await global.buildDoAction(act,arg);
        return await dataToSimple(engine,`${act}:${arg}@cmp-action`,result);
    },
    async ["cmp-flag-set"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-set"
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 2) throw new Error(`${opName}: expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(flagName,value)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        let value = await assertToStatic(body[1],"value",opName)
        
        assertPermissionFromSet(engine,"policy-flag-write",key,"modify a flag")
        Flags.set(key,value);
    },
    async ["cmp-flag-get"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-get"
        //assertAdmin(engine,"setting admin-only flags");
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 1) throw new Error(`${opName}: expected 1 argument, got ${
            body.length
        }\nusage: ${opName}(flagName)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        let flagData = Flags.get(key);
        return await dataToSimple(engine,`${key}@flags`,flagData)
    },
    async ["cmp-flag-setEntry"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-setEntry"
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 3) throw new Error(`${opName}: expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(flagName,key,value)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        if(key == null) throw new Error(`${opName} flag name was nullish?!`);
        let subKey = await assertToStatic(body[1],"key",opName)
        let value = await assertToStatic(body[2],"value",opName)

        assertPermissionFromSet(engine,"policy-flag-write",key,"modify a flag")

        new Flag(key).set(subKey,value);
    },
    async ["cmp-flag-addEntry"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-addEntry"
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 2) throw new Error(`${opName} expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(flagName,value)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        if(key == null) throw new Error(`${opName} flag name was nullish?!`);
        let value = await assertToStatic(body[1],"value",opName)

        assertPermissionFromSet(engine,"policy-flag-write",key,"modify a flag")
        new Flag(key).add(value);
    },
    async ["cmp-flag-deleteEntry"](engine, astBlock, assignTo) {
        const opName = "cmp-flag-deleteEntry"
        assertAdmin(engine,"setting admin-only flags"); //TODO: add allowance for non admin flags
        assignTo = engine.resolveWants(assignTo);
        const { body } = astBlock;
        if(body.length != 2) throw new Error(`${opName} expected 2 arguments, got ${
            body.length
        }\nusage: ${opName}(flagName,value)`);
        
        let key = await assertToStatic(body[0],"flagName",opName)
        if(key == null) throw new Error(`${opName} flag name was nullish?!`);
        let value = await assertToStatic(body[1],"value",opName)

        assertPermissionFromSet(engine,"policy-flag-write",key,"modify a flag")
        new Flag(key).delete(value);
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
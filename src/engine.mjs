
import { BiliRawVar,BiliRegister,BiliValueVar,BiliVar,VAR_DEBUG,VAR_NULL,VAR_WANTS_REG,VAR_WANTS_VAR,BiliGlobalzVar } from "./engine-vars.mjs"
import Path from "path";
import { Flag } from "./flags.mjs";


const LEVEL_USER = new Flag("level-user").value

/** @returns {bool} */
let debug_lifecycle = false;
new Flag("debug-lifecycle").defaultTo(false).addSetterWatch(v=>debug_lifecycle=v)
/** @returns {bool} */
let debug_scopeChanges = false;
new Flag("debug-scopeChanges").defaultTo(false).addSetterWatch(v=>debug_scopeChanges=v)

export class BiliEngine {
    tempVars; baseScope; currentScope; OPs; registerSlots;
    completedVarFinalize = false;
    completedVar2word = false;
    /** @returns {BiliEngine} */
    constructor() {

        this.varRegistery = new Set();

        this.registerSlots = new Array(20);

        this.opCounter = -1;

        this.VAR_NULL = VAR_NULL;
        this.VAR_DEBUG = VAR_DEBUG;
        this.VAR_WANTS_REG = VAR_WANTS_REG;
        this.VAR_WANTS_VAR = VAR_WANTS_VAR;

        this.OPs = [];
        this.baseScope = {
            name: "root",
            vars: new Map(),
            depth: 0,
            realDepth: 0,
        }
        this.baseScope.context = {
            file: null, 
            dir:".",
            ref:"<system>",
            name: "<internal:root>",
            base: this.currentScope,
            permission:LEVEL_USER, 
        },

        this.baseScope.vars.set("null", VAR_NULL);
        this.baseScope.vars.set("debug-var", VAR_DEBUG);
        this.currentScope = this.baseScope;
        this.push("base");

    }
    /**
     * @param  {...string|...Function} op 
     * @returns {Array<string|Function>}
     * @deprecated
     */
    writeOP(...op) {
        op = [...op]
        this.OPs.push(op);
        this.opCounter++;
        return op;
    }
    /**
     * @returns {void}
     * @param {BiliVar} target
     * @param {BiliVar} src source
     */
    async setterOP(target,src){
        let op = this.newOP();
        await src.openRead();
        await target.openWrite();
        op.push("set");
        op.pushWrite(target);
        op.pushRead(src);
        op.place();
        await src.closeRead();
        await target.closeWrite();
    }

    /**
     * 
     * @param {type:string;} astBlock 
     * @param {BiliVar} assignTo 
     * @returns 
     */
    async commonBlockHandle(astBlock, assignTo) {
        if(astBlock === undefined) throw new Error(`engine-internals: call to \`commonBlockHandle(astBlock,assignTo){...}\` has no astBlock; (astBlock === undefined)`);
        if(astBlock.line != null) this.currentScope.line = astBlock.line;
        switch (astBlock.type) {
            case "value":
                {
                    const valvar = new BiliValueVar(this, "inlineValue", astBlock.value);
                    if (assignTo && assignTo.assertive) {
                        await this.setterOP(assignTo,valvar);
                    }
                    return valvar;
                }

            case "word":
                {
                    const valvar = this.getVar(astBlock.value)
                    if (assignTo && assignTo.assertive) {
                        await this.setterOP(assignTo,valvar);
                    }
                    return valvar;
                }
            case "call":
                {
                    const { head, body } = astBlock
                    const callee = await this.commonBlockHandle(head, this.VAR_NULL);

                    return callee.onExec(this, astBlock, assignTo);
                    //const [op,fnName,_0,subAST] = astBlock;
                    //const varExec = this.getVar(fnName);
                    //return varExec.onExec(subAST,this,assignTo);
                }

            case "block":
                {
                    return await this.commonBlockHandle({
                        "type": "call",
                        "head": {
                            "type": "word",
                            "value": "do"
                        },
                        "body": astBlock.body
                    },assignTo)
                }

            case "declaration":
                {
                    const { head, body } = astBlock

                    let resultVar;
                    { //get asignTo from body
                        resultVar = await this.commonBlockHandle(body[0], this.VAR_WANTS_REG); //replace body[0] with call to 'do'
                    }

                    {
                        //call and invoke fn...
                    }

                    /*pseudo-else*/
                    if (head.type === "word" || head.type === "atWord") {
                        this.currentScope.vars.set(head.value, resultVar);
                        return resultVar; //TODO add auto cleanup return;
                    }
                    //this.commonBlockHandle()
                    //return;
                    throw new Error("unimplemented action for left hand side of declaration: "+JSON.stringify(head.type))
                }
            case "assignment":
                {
                    const { head, body } = astBlock
                    
                    //get asignTo from body
                    const assignToVar = await this.commonBlockHandle(head,this.VAR_NULL);
                    const resultVar = await this.commonBlockHandle(body[0], assignToVar); //replace body[0] with call to 'do'
                    return assignToVar;
                }
            case "atWord":
                {
                    const valvar = this.getVar("@"+astBlock.value)
                    if (assignTo && assignTo.assertive) {
                        await this.setterOP(assignTo,valvar);
                    }
                    return valvar;
                }

            default: throw new Error(`engine-internals: unhandled type: ${astBlock.type}`)
        }
    }
    getWordValue(word){
    if(word.type == "word" || word.type == "value") return word.value;
    else if(word.type == "atWord") return "@"+word.value;
    else throw new Error("var-raw: expected 1 argument of type [word,string] got: "+word.type);
    
    }

    newOP() {
        const op = new BiliOP(this);
        return op;
    }

    resolveWants(mabeWants) {
        if (mabeWants === VAR_WANTS_REG) {
            return this.newRegister();
        }
        if (mabeWants === undefined){
            throw new Error(`engine-internals: assignTo was undefined (attempt to resolveWants)`);
        }
        return mabeWants;
    }
    //for calls that dont resolve their assignTo due to being only logical
    //
    async assignToResolve(wantsReturn,assignTo){
        if(assignTo === this.VAR_WANTS_REG)return wantsReturn; //its a want, fufill
        if(assignTo === this.VAR_NULL)return wantsReturn;
        
        await this.setterOP(assignTo,wantsReturn);
        return wantsReturn;
    }

    newRegister() {
        return new BiliRegister(this);
    }
    *stackAsArray(){
        let scopeSeek = this.currentScope;
        while (true) {
            if (!scopeSeek) break;
            yield scopeSeek;
            scopeSeek = scopeSeek.parent;
        }
    }
    getVar(named, startAt) {
        startAt ??= this.currentScope;
        let scopeSeek = startAt;
        while (true) {
            if (!scopeSeek) break;
            const vars = scopeSeek.vars
            if (vars.has(named)) return vars.get(named);
            scopeSeek = scopeSeek.parent;
        }
        //if we dont have it, create it;
        const isGlobalz = named[0] == "@";

        const newVar = ( isGlobalz
            ? new BiliGlobalzVar(this, `${named}@${startAt.name}`,named)
            : new BiliVar(this, `${named}@${startAt.name}`)
        ) 

        ;(isGlobalz ? startAt.context.base : startAt).vars.set(named, newVar);
        return newVar;
    }
    push(name) {
        if(debug_scopeChanges) console.debug(`push:`,name);
        this.currentScope = {
            parent: this.currentScope, //parent of logical operations
            popTo: this.currentScope, //parent of real stack; allows for offshoots and closures
            name,
            depth: this.currentScope.depth + 1,
            realDepth: this.currentScope.realDepth + 1,
            vars: new Map(),
            context: this.currentScope.context,
        }
    }
    pushCustom(obj) {
        if(debug_scopeChanges) console.debug("push-cst:",obj.name)
        obj.popTo = this.currentScope;
        obj.depth = this.currentScope.depth + 1;
        this.currentScope = obj
    }
    pop() {
        if(debug_scopeChanges) console.debug(`pop:`,this.currentScope.name);
        const parent = this.currentScope.popTo;
        if (!parent) throw new Error("attempted to pop root scope");
        this.currentScope = parent;
    }

    async handleFinalize() {

        //optimize the OPs;
        this.OPs = Array.from(this.OPs);

        while (!this.completedVarFinalize) {
            this.completedVarFinalize = true;
            for (const varE of this.varRegistery) {
                if(varE.assertCleanup){
                    if (varE.isReadOpened) throw new Error(`engine-internals: ${(varE.name)} wasnt closed for reading`);
                    if (varE.isWriteOpened) throw new Error(`engine-internals: ${(varE.name)} wasnt closed for writing`);
                }

                if (varE.birthLine != null) {
                    if(debug_lifecycle)console.log("birth op:", varE.birthLine);
                    const ln = this.OPs[varE.birthLine];
                    if (!ln.births) ln.births = new Set();
                    ln.births.add(varE)
                }

                if (varE.deathLine != null) {
                    const ln = this.OPs[varE.deathLine];
                    if(debug_lifecycle)console.log("death op:", varE.deathLine);
                    if (!ln.deaths) ln.deaths = new Set();
                    ln.deaths.add(varE)
                }

                //do I need to do anything else on varE?
            }
        }

        while (!this.completedVar2word) {
            this.completedVar2word = true;

            for (const op of this.OPs) {
                //FINISHME
                if (op.births) {
                    for (const birth of op.births) {
                        birth.onBirth?.()
                    }
                    op.births = null;
                }
                for (var i = 0; i < op.length; i++) {
                    let mo = op[i];
                    if (typeof mo === "string") continue;
                    if (typeof mo === "number") continue;
                    if (mo === null) continue;
                    if (mo === undefined) throw new Error(`engine-internals: stampable is undefined`);
                    if (!mo.onOpStamp) {
                        throw new Error(`engine-internals: stampable ${mo.name ?? String(mo)} has no onStamp method`);
                    }
                    let out = mo.onOpStamp(op, i);
                    if (out === undefined) 
                    throw new Error("engine-internals: failed to stamp " + (mo ? mo.name : String(mo)));
                    op[i] = out;
                }
                if (op.deaths) {
                    for (const death of op.deaths) {
                        death.onDeath?.();
                    }
                    op.deaths = null;
                }
            }
        }
    }
}

export class BiliOP extends Array {
    constructor(engine, ...a) {
        super(...a);
        this.engine = engine;
    }
    place() { //adds to the OPs;
        this.engine.OPs.push(this);
        this.engine.opCounter++;
    }
    pushValue(string) { //TODO improve
        this.push(JSON.stringify(string))
    }
    pushWrite(targVar) {
        if (!targVar.isWriteOpened){
            if(!targVar.assertCleanup) 
                throw new Error(`attempted to read from variable ${JSON.stringify(targVar.name)} does not implement writing`);
            throw new Error(`attempted to write to variable ${JSON.stringify(targVar.name)} closed to writing`);
        }
        this.push(targVar.onWrite(this));
    }
    pushRead(targVar) {
        if (!targVar.isReadOpened){
            if(!targVar.assertCleanup) 
                throw new Error(`attempted to read from variable ${JSON.stringify(targVar.name)} does not implement reading`);
            throw new Error(`attempted to read from variable ${JSON.stringify(targVar.name)} closed to reading`);
        }
        this.push(targVar.onRead(this));
    }
}

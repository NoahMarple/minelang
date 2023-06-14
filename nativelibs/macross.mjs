import { BiliVar, VAR_NULL } from "../src/engine-vars.mjs";
import { unAST } from "../src/unAST.mjs";


const debug_expose_internals = true;

//garenteed to be metods; engages proxy mode

const proxyTriggerKeys = {
    onRead:true,
    orWrite:true,
}

const proxyTriggerKeysAsync = { //use hasOwnProperty
    genaricPrepare:true,
    openRead:true,
    closeRead:true,
    openWrite:true,
    closeWrite:true,
    onExec:true, //proxies but is caught before enabling proxy
}

let resolves = 0;

export class BiliUnevaluatedVar extends BiliVar {
    isInitlised = true
    constructor(engine, ast, evaluatorRawScope) {
        super(engine, `Unevaluated(${unAST(ast)})`, ast);


        let result,gotResult = false;

        evaluatorRawScope ??= engine.currentScope;

        const proxyCache = Object.create(null);

        const proxyActionAsync = async (action,...args)=>{
            if(resolves > 500) console.error("engine-internals: accedental recursion with proxy object");
            resolves++;
            pushMyScope()
            if(!gotResult){
                await getEvaluated();
                gotResult = true; //enable proxy
            }
            const ok = await result[action](...args) 
            engine.pop();
            resolves--;
            return ok;
        }

        const proxyAction = (action,...args)=>{
            pushMyScope()
            const ok = result[action](...args) 
            engine.pop();
            return ok;
        }

        const pushMyScope = ()=>{
            const myNew = Object.create(evaluatorRawScope);
            myNew.name = `proxied: ${myNew.name}`;
            engine.pushCustom(myNew);
        }

        
        const getEvaluated = async ()=>{
            result = await engine.commonBlockHandle(this.data, engine.VAR_WANTS_REG);
            return result;
        }

        const proxySettings = {
            get(self, k) {
                //REMEMBER! minimize k == "thing" accesses as their in order execution and not js key access optimized
                //attempt to use key access if possable


                if(debug_expose_internals && k == "debug")return {engine,result,gotResult,evaluatorRawScope,proxyCache,proxyAction,pushMyScope,getEvaluated};

                if (k == "name") return self.gotResult ? `Proxy(${self.target.name})` : self.name;

                //catches below statements
                if(!gotResult && k == "onExec"){ //if gotResult, wont short-cirut
                    //direct and repeatable (wont lock into proxy mode) access
                    const ok = async (engine,astBlock,assignTo)=>{
                        pushMyScope();
                        await getEvaluated() //reflect;
                        return result; //TODO do copy OP if possable
                        engine.pop();
                    } 

                    return ok
                }

                if(proxyCache[k])return proxyCache[k];
                if(Object.hasOwn(proxyTriggerKeysAsync,k)){
                    const ok = proxyActionAsync.bind(this,k);
                    proxyCache[k] = ok;
                    return ok;
                }
                if(Object.hasOwn(proxyTriggerKeys,k)){
                    const ok = proxyAction.bind(this,k);
                    proxyCache[k] = ok;
                    return ok;
                }

                let retn;
                //access if gotten
                if (gotResult) retn = Reflect.get(result, k);
                if (retn !== undefined) return retn;

                //...
            },
            //TODO: add setter method simmlar to getter
        };
        return new Proxy(this, proxySettings)
    }
}

const installme = {
    //semi-stable
    async ["macross"](engine, astBlock, assignTo) {
        let vars = astBlock.body.map(v => engine.getWordValue(v))

        let macrossDef = new BiliVar(engine, `Macross-defining(${vars.join(", ")})`)
        macrossDef.isInitlised = true

        macrossDef.onExec = async (engine, astBlock, assignTo) => {
            let runner = Object.create(astBlock);
            runner.head = {
                "type": "word",
                "value": "do"
            }

            const macroScope = engine.currentScope;

            let bv = new BiliVar(engine, `Macross(${vars.join(", ")})`);
            bv.args = vars;
            bv.callee = runner;
            bv.isInitlised = true
            bv.onExec = async function (engine, astBlock, assignTo) {
                const { body } = astBlock

                const calleeScope = engine.currentScope;

                {
                    const mscope = Object.create(macroScope);
                    mscope.name = "macross-proxied: "+mscope.name;
                    mscope.popTo = engine.currentScope;
                    engine.pushCustom(mscope);
                }

                engine.push(`macross-macro(${vars.join(", ")})`);

                vars.forEach((k, i) => {
                    let bodV = body[i];
                    engine.currentScope.vars.set(k,
                        bodV
                            ? new BiliUnevaluatedVar(engine, bodV, calleeScope)
                            : engine.VAR_NULL
                    );
                });

                const out = await engine.commonBlockHandle(runner, assignTo)

                engine.pop();
                engine.pop();
                
                return out;
            }
            return bv;
        }
        return macrossDef;

    },
    async ["complex"](engine, astBlock, assignTo) {
        const complex = new BiliVar(engine,`Complex()`);
        let myOutput,myInput;
        const complexScope = engine.currentScope

        const properties = Object.create(null);
        for (const ast of astBlock.body) {
            if(ast.type == "assignment"){
                const key = engine.getWordValue(ast.head);
                const body = ast.body[0]

                switch(key){
                    case "get-open":
                    case "get-close":
                    case "set-open":
                    case "set-close":
                        properties[key] = new BiliUnevaluatedVar(engine,body);
                        break;
                    case "set-to":
                        properties[key] = engine.getWordValue(body);
                }
            }
            else throw new Error(`must be assignment`); //TODO make more sense
        }
        properties["set-to"] ??= "__set-to";
        const myProto = BiliVar.prototype
        Object.assign(complex,{
            isInitlised:true,
            async openRead(){
                await myProto.openRead.call(this);
                myOutput = engine.VAR_NULL;
                if(properties["get-open"])myOutput = await properties["get-open"].onExec(engine,{},engine.VAR_WANTS_REG);
                await myOutput.openRead();
            },
            onRead(){
                return myOutput.onRead();
            },
            async closeRead(){
                await myProto.closeRead.call(this);
                await myOutput.closeRead();
                if(properties["get-close"]) await properties["get-close"].onExec(engine,{},engine.VAR_NULL);
                myOutput = engine.VAR_NULL;
            },
            async openWrite(){
                await myProto.openWrite.call(this);
                myInput = engine.VAR_NULL;
                if(properties["set-open"]){
                   myInput = await properties["set-open"].onExec(engine,{},engine.VAR_WANTS_REG);
                   complexScope.vars.set(properties["set-to"],myInput)
                }
                await myInput.openWrite();
            },
            onWrite(){
                return myInput.onWrite();
            },
            async closeWrite(){
                await myProto.closeWrite.call(this);
                await myInput.closeWrite();
                if(properties["set-close"]) await properties["set-close"].onExec(engine,{},engine.VAR_NULL);

                myInput = engine.VAR_NULL;
                complexScope.vars.set(properties["set-to"],myInput)
            },
        })
        return await engine.assignToResolve(complex,assignTo)
    },
    async ["unevaluated"](engine, astBlock, assignTo) {
        return new BiliUnevaluatedVar(engine, astBlock.body[0])
    }
}

export function installBiliLib(engine) {
    for (const [k, v] of Object.entries(installme)) {
        const tok = engine.getVar(k, engine.currentScope.parent);
        if (tok.isInitlised) continue;
        tok.onExec = v;
        tok.isInitlised = true;
        tok.name = `${k}@lib-macross`
    }
}

export function returnBiliLib(engine) {
    return engine.VAR_NULL;
}
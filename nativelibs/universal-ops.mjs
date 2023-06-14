import { BiliRegister, BiliVar, VAR_NULL, VAR_WANTS_REG } from "../src/engine-vars.mjs";

const testOptomizable = new Set(("eq,neq,lt,gt,gteq,lteq").split(","));
const testInversions = {
    "eq":"neq", "neq":"eq",
    "true":"false", "false":"true",
    "lt":"gteq", "gteq":"lt",
    "gt":"lteq", "lteq":"gt"
}
const testToOutVerb = {
    "true":"always",
    "false":"never",
    "eq":"equal",
    "neq":"notEqual",
    "lt":"lessThan",
    "gt":"greaterThan",
    "lteq":"lessThanEqual",
    "gteq":"greaterThanEqual"
}

export async function globalzToStatic(gzvar){
    await gzvar.genaricPrepare();
    if(!gzvar.isInitlised){
        //convert to globalz, (unstable?)
        gzvar.isGlobalz = true;
        gzvar.isInitlised = true;
        gzvar.isReadOpened = true;
        gzvar.isWriteOpened = true;
        gzvar.assertCleanup = false;
    }
    if(!gzvar.isGlobalz){
        throw new Error(`${gzvar.name} must be a globalz (attempt to convert to static)`);
    }
    if(gzvar.writeTimes > 0){
        throw new Error(`${gzvar.name} cannot be written to (attempt to convert to static)`);
    }
    gzvar.onOpStamp = (op,i) => gzvar.data
    gzvar.isStatic = true
}

class BiliCellVar extends BiliVar {
    isInitlised = true; reg;
    constructor(engine,connectP,connectK){
        let name = `cell(${connectP.name},${connectK.name})`
        super(engine,name);
        this.connectK = connectK;
        this.connectP = connectP;
    }
    async openRead(){
        await super.openRead();
        this.reg = engine.newRegister();
        const {connectK,connectP,reg} = this;
        await connectK.openRead();
        await connectP.openRead();
        await reg.openWrite();
        
        //valid arg order
        const op = engine.newOP();
        op.push("read");
        op.pushWrite(reg);
        op.pushRead(connectP);
        op.pushRead(connectK);
        op.place();

        await connectK.closeRead();
        await connectP.closeRead();
        await reg.closeWrite();

        await reg.openRead();
    }
    onRead(){
        super.onReadReady();
        return this.reg.onRead();
    } 
    async closeRead(){
        await super.closeRead();
        await this.reg.closeRead();
    }
}

const installme = {

    async ["print"](engine,astBlock,assignTo){
        const {body} = astBlock;
        let ent,val;
        for (ent of body) {
            val = await engine.commonBlockHandle(ent,engine.VAR_WANTS_REG); 
            let op = engine.newOP();

            await val.openRead();

            op.push("print");
            op.pushRead(val);
            op.place();

            await val.closeRead();
        }
        return val;

    },
    async ["lbl"](engine,astBlock,assignTo){
        const {body} = astBlock;
        let [target] = body;
        target = await engine.commonBlockHandle(target,engine.VAR_WANTS_VAR);
        await globalzToStatic(target);
        target.data = engine.opCounter+1;

        return target;

    },
    async ["jmp"](engine,astBlock,assignTo){
        const {body} = astBlock;
        const [target] = body;

        const jmpto = await engine.commonBlockHandle(target,engine.VAR_WANTS_REG);
        let jmptoStatic = jmpto.toStatic?.();
        if(Number.isInteger(jmptoStatic)){ //because of the setup, I can only do it if its a literal integer
        let op2 = engine.newOP();
        op2.push("jump");
        op2.pushRead(jmpto);
        op2.push("always");
        op2.place();
        } else {
            let op2 = engine.newOP();
            op2.push("set","@counter");
            op2.pushRead(jmpto);
            op2.place();
        }

        //op hook
    },
    async ["if"](engine,astBlock,assignTo){ //strictly 2 ops UNSTABLE and UNFINISHED
        assignTo = await engine.resolveWants(assignTo)
        let canStaticTest = false,canGlobalzTarget = false
        let static_A,static_B,static_test;
        const {body} = astBlock;
        const [test,doTrue,doFalse] = body;
        if(test.type == "call" &&
        test.head.type == "word" &&
        testOptomizable.has(test.head.value)
        ) {
            static_test = test.head.value;
            let b;
            static_A = (b = test.body[0]) ? await engine.commonBlockHandle(b,engine.VAR_WANTS_REG) : engine.VAR_NULL;
            static_B = (b = test.body[1]) ? await engine.commonBlockHandle(b,engine.VAR_WANTS_REG) : engine.VAR_NULL;
            canStaticTest = true;
        }

        //const targetVar = await engine.commonBlockHandle(test,engine.VAR_WANTS_REG);

        //if(targetVar.isGlobalz) canGlobalzTarget = true;

        if(canStaticTest){
            let return_type = (assignTo === engine.VAR_NULL) ? engine.VAR_NULL : engine.VAR_WANTS_REG;

            let op1 = engine.newOP();
            let op2 = engine.newOP();
            let opAsn1 = engine.newOP();
            let opAsn2 = engine.newOP();

            await static_A.openRead();
            await static_B.openRead();

            op1.push("jump");
            op1.push(null);
            op1.push(testToOutVerb[testInversions[static_test]]);
            op1.pushRead(static_A);
            op1.pushRead(static_B);
            

            await static_A.closeRead();
            await static_B.closeRead();

            op1.place();

            const outTrue = doTrue ? await engine.commonBlockHandle(doTrue,return_type) : engine.VAR_NULL;

            if(assignTo !== engine.VAR_NULL){
                await assignTo.openWrite()
                await outTrue.openRead()
                opAsn1.push("set");
                opAsn1.pushWrite(assignTo);
                opAsn1.pushRead(outTrue);
                opAsn1.place();
                await outTrue.closeRead()
                await assignTo.closeWrite()
            };
            
            op2.push("jump",null,"always",null,null)
            op2.place();

            op1[1] = engine.opCounter+1 //put line no;

            const outFalse = doFalse ? await engine.commonBlockHandle(doFalse,return_type) : engine.VAR_NULL;

            if(assignTo !== engine.VAR_NULL){
                await assignTo.openWrite()
                await outFalse.openRead()
                opAsn2.push("set");
                opAsn2.pushWrite(assignTo);
                opAsn2.pushRead(outFalse);
                opAsn2.place();
                await outFalse.closeRead()
                await assignTo.closeWrite()
            };
            op2[1] = engine.opCounter+1 //put line no;

            return assignTo;

            //jump -1 always x false
            //jump 1 notEqual x false
            //read result cell1 0

        }


        return 0;
    },
    async ["cell"](engine,astBlock,assignTo){
        const {body} = astBlock;

        if(body.length == 2){
            const [lP,lK] = body;
            const eP = await engine.commonBlockHandle(lP,engine.VAR_WANTS_REG);
            const eK = await engine.commonBlockHandle(lK,engine.VAR_WANTS_REG);
            return new BiliCellVar(engine,eP,eK);
        }
        if(body.length == 1){
            throw new Error(`WIP`)
        }
        throw new Error(`WIP`)
    }
}

export function installBiliLib(engine){
    for( const [k,v] of Object.entries(installme)){
        const tok = engine.getVar(k,engine.currentScope.parent);
        if(tok.isInitlised) continue;
        tok.onExec = v;
        tok.isInitlised = true;
        tok.name = `${k}@corelib`
    }
}

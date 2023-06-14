import { Flags,Flag, stringToValue } from "./src/flags.mjs";
import { BiliEngine } from "./src/engine.mjs"
import { CompileError, CodeError, buildAST } from "./lang.mjs";
import { promises as FS } from 'fs';
import Path from "path";
import { unAST } from "./src/unAST.mjs";
//import { installCorelb } from "./engineCorelib.mjs";
import { fileURLToPath } from 'url'
import { BiliBlobVar,BiliValueVar, BiliVar } from "./src/engine-vars.mjs";
const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)

let debugAST = false;
let debugLineNo = false;
let debugNoEval = false;


//dumps the AST for inspection
new Flag("debug-ast",false).addSetterWatch(v=>debugAST = v);
//adds operation numbers to output, usually breaking the script
new Flag("debug-opnum",false).addSetterWatch(v=>debugLineNo = v);
//does not eval imports, returns AST
new Flag("debug-parseonly",false).addSetterWatch(v=>debugNoEval = v);


let actionsHeader, actions, actionsFooter, actionsNext, buildscripts;

new Flag("cmp-buildscripts").defaultTo(false).addSetterWatch(v=>buildscripts = v);

new Flag("do-first").defaultToFn(()=>new Set(["init","cmp:core"])).addSetterWatch(v=>actionsHeader = v);
new Flag("do").defaultToFn(()=>new Set(["cmp-mainfile"])).addSetterWatch(v=>actions = v); //use do-next or do-last instead whane in .mindbld file
new Flag("do-last").defaultToFn(()=>new Set(["bake","output-screen"])).addSetterWatch(v=>actionsFooter = v);
new Flag("do-next").defaultToFn(()=>new Set()).addSetterWatch(v=>actionsNext = v); //allows for interjection 


let mindbld_level, mindc_level;
new Flag("policy-mindbld-level").defaultTo(6).addSetterWatch(v=>mindbld_level = v);
new Flag("policy-mindc-level").defaultTo(2).addSetterWatch(v=>mindc_level = v);



if (!process.argv[2]) {
    console.log("usage: ... <path_to_mainfile>")
    process.exit(3);
}

const argvGen = process.argv[Symbol.iterator]();

argvGen.next(); argvGen.next();

let mainfilePath = argvGen.next().value;
new Flag('cmp-mainfile').defaultTo(mainfilePath).addSetterWatch(v=>mainfilePath = v);


let engine;

/**
 * @param {string} path 
 * @param {bool|any} trustedAccess 
 * @returns {string} reformed global string
 */
global.pathTransform = function pathTransform(path,trustedAccess) {
    //TODO: add safety logic;
    path = Path.resolve(engine.currentScope.context.dir,path); //reativize to subdir
    path = Path.relative(process.cwd(),path); //convert to cwd relative equivlant
    if(!trustedAccess) path = Path.join("/",path); //flatten to remove access to below CWD 
    path = Path.join(".",path); //correct from prev op

    return path;
}

/**
 * @beta
 * @untested
 * @param {string} path path to module in our compiler
 * @returns {Promise<Module>} resulting module
 */
global.importNative = function importNative(path){
    const abspath = Path.resolve(__dirname,path)
    return import(abspath);
}
 
let levelNames = ["everybody","lesser user","user","lesser power-user","power-user","lesser admin","admin","almost nobody","nobody"]

global.assertPermissionFromSet = (engine,flagName,key,action)=>{
    const level = new Flag(flagName).get(key);
    const myLevel = engine.currentScope.context.permission ?? 0;
    if(Number.isInteger(level)){
        if(myLevel >= level)return;
        else throw new Error(`permission denied: ${action}\ntest: your level <${levelNames[myLevel] ?? "level-"+level}> less than (${JSON.stringify(key)} from ${JSON.stringify(flagName)
        } which is <${levelNames[level] ?? "level-"+level}>)`)
    }
    throw new Error(`permission denied: ${action}\ntest: invalid permissions`);
}

global.assertPermissionFromValue = (engine,flagName,action)=>{
    const level = new Flag(flagName).value;
    const myLevel = engine.currentScope.context.permission ?? 0;
    if(Number.isInteger(level)){
        if(myLevel >= level) return;
        else throw new Error(`permission denied: ${action}\ntest: your level <${
            levelNames[myLevel] ?? "level-"+level}> less than (flag ${JSON.stringify(flagName)
        } which is <${levelNames[level] ?? "level-"+level}>)`)
    }
    
}


/**
 * @param {string} name module's access symbol (name or path)
 * @param {BiliVar|*} assignTo engine's assignTo
 * @param {bool} trustedAccess 
 * @returns {BiliVar|*}
 */
global.useLib = async function useLib(name, assignTo, trustedAccess) {

    if (name.indexOf("/") !== -1 || name.indexOf("\\") !== -1) {
        let transName = pathTransform(name,trustedAccess), ext = Path.extname(name);
        if (ext == ".mindc" || ext == ".mindbld") {
            let fileData;
            //let it fail
            fileData = await FS.readFile(transName, "utf8");
            let readMain = new buildAST(fileData);
            readMain = {
                "type": "call",
                "head": {
                    "type": "word",
                    "value": "do"
                },
                "body": readMain
            }
            if(debugAST) await FS.writeFile(Path.join(__dirname,"astDebug",encodeURIComponent(name)+".mindc"), unAST(readMain, true, 99));
            let rtn;
            
            if(debugNoEval)return new BiliBlobVar(readMain); 
            else {

            
            engine.push("file:" + transName);
            engine.currentScope.context = { 
                file: transName,
                dir:Path.dirname(transName), 
                ref: "file:" + transName,
                base:engine.currentScope,
                permission:(ext == ".mindbld") ? mindbld_level : mindc_level,
            };
            if(!buildscripts && ext == ".mindbld") throw new Error(`blocked buildscript from running: ${JSON.stringify("file:"+transName)}\nif you trust this script that can potentially access you computer, enable build scripts with the 'cmp-buildscripts' flag`)
            {
                rtn = await engine.commonBlockHandle(readMain, assignTo);
            };
            engine.pop();
            return rtn;
            }
        }
        if (ext == ".mjs") {
            let rtn;

            //let it fail
            await FS.stat(transName, "utf8");

            engine.push("native:" + transName);
            engine.currentScope.context = { file: transName, dir:Path.dirname(transName), ref: "native:" + transName, permission:mindbld_level };

            {
                const mod = await import("file:"+Path.resolve(process.cwd(),transName));
                await mod.installBiliLib?.(engine);
                rtn = await mod.returnBiliLib?.(engine) ?? engine.VAR_NULL;
            };
            engine.pop();
            return rtn;
        }
        throw new Error(`import: unusable extension for file: ${name}\ncan handle: {mjs:"native",mindc:"lang"}`)
    }

    let tests = [];
    for (const uname of (function* () {
        yield Path.join(__dirname, "nativelibs", name + ".mjs");
        yield Path.join(__dirname, "nativelibs", name + ".mindc");
        yield Path.join(__dirname, "nativelibs", name + ".mindbld");
    })()) {
        try{ 
            tests.push(uname);
            return await useLib(uname,assignTo,true);
        }
        catch(e){
            if(e.code == "ENOENT");
            else throw e;
        }
    }
    throw new Error(`import: cannot find symbol: ${JSON.stringify(name)}\n\n${tests.map(m=>"tried: "+m).join("\n")}\n`)

}

//process.exit(0);

for (const arg of argvGen) {
    const argI = arg.indexOf("=");
    if(argI == -1){
        Flags.set(arg,true);
    } else {
        const key = arg.substring(0,argI);
        const val = arg.substring(argI+1);
        Flags.set(key,stringToValue(val));
    }
}



//installCorelb(engine);


//await useLib("core",engine.VAR_NULL,true);



//console.log("lines:", engine.OPs.length);
//console.log("last:", engine.lineNo);


//TEMP

function splitOne(str,dilim){
    let idex = str.indexOf(dilim??",");
    if(idex < 0)return [str];
    return [
        str.substring(0,idex),
        str.substring(1+idex,str.length),
    ]
}

function outputTOScreen(){
    if(!engine) console.warn("WARN: no engine to compile any code")
    console.log("------ [output] ------")
    if(engine) console.log(engine.OPs.map((m,i) => (debugLineNo? `op ${i}: `: "")+ m.join("\t")).join("\n"))
    console.log("------  [end]   ------")
}

async function placeStop(pallete){
    if(!engine) throw new Error(`attempt place a 'stop' without an engine`)
    if(!pallete) return
    await pallete.openRead();
    const op = engine.newOP();
    op.push("stop");
    op.pushRead(pallete);
    op.place();
    await pallete.closeRead();
}

let pallete = null; //return value of the operation
let needsStop = false;

async function doAction(act,arg){
    switch (act){
        default: throw new Error(`unknown action: ${JSON.stringify(act)}:${JSON.stringify(arg ?? null)}`)

        case "output-screen": outputTOScreen(); break;
        case "cmp-mainfile":
            arg = mainfilePath;
        case "cmp": {
            if(!engine) throw new Error(`attempt to compile ${JSON.stringify(arg)} without an engine`)
            pallete = await useLib(arg, engine.VAR_NULL);
            needsStop = true;
            return pallete;
        };

        case "write-stop": needsStop = false; placeStop(pallete); break;
        case "init": {
            engine = new BiliEngine();
            globalThis.engine = engine;
        }; break;
        case "bake":
            if(needsStop) placeStop(pallete);
            await engine.handleFinalize(); 
        break;
    }
}

global.buildDoAction = doAction;

try {
if(Array.isArray(actions) || actions instanceof Set);
else throw new Error(`the flag 'do' should be an Array or Set`);
for (const action of (function*(){  
    for (const v of actionsHeader) {
        yield v;
        if(actionsNext.size > 0) {
            yield* actionsNext;
            actionsNext.clear();
        }
    }
    for (const v of actions) {
        yield v;
        if(actionsNext.size > 0) {
            yield* actionsNext;
            actionsNext.clear();
        }
    }
    for (const v of actionsFooter) {
        yield v;
        if(actionsNext.size > 0) {
            yield* actionsNext;
            actionsNext.clear();
        }
    }
})()) {
    let [act,arg] = splitOne(action,":");
    await doAction(act,arg);
}
} 
catch(e) {
    if(engine){
        console.error("failed at:")
        for(const scope of engine.stackAsArray()){
            console.log(`scope:\r\t   ${scope.line != null ? "line: "+scope.line : "---"}\r\t\t\t${scope.name}`)
        }
    } else {
        console.error("failed without engine");
        console.error("consider adding the flag 'do+init' at the beginning to add one");
    }
    throw e;
}
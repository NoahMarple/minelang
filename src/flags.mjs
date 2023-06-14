
function regexSame(r1, r2) {
    if (r1 instanceof RegExp && r2 instanceof RegExp) {
        var props = ["global", "multiline", "ignoreCase", "source", "dotAll", "sticky", "unicode"];
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            if (r1[prop] !== r2[prop]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export function stringToValue(str,allowAmpersand){
    const {stringLiterals} = stringToValue;
    const strTrim = str.trim();
    if(Object.hasOwn(stringLiterals,strTrim))return stringLiterals[strTrim];
    const strnum = Number(str);
    if(!isNaN(strnum))return strnum;

    const strMode = strTrim[0];
    if(strTrim[1] == "?" && allowAmpersand !== false){
        const strVal = strTrim.substring(2);
        //raw
        if(strMode == "r") return strVal;
        //array
        if(strMode == "a") return (strVal.length <= 2) ? new Array() /*empty if no more chars*/ 
            : strVal.split(",").map(v=>stringToValue(v,allowAmpersand));
        //permission filter construct
        if(strMode == "f") return (strVal.length <= 2) ? new Filter() /*empty if no more chars*/ 
            : new Filter(strVal.split(",").map(v=>stringToValue(v,allowAmpersand)));
        //Set data type
        if(strMode == "s") return (strVal.length <= 2) ? new Set() /*empty if no more chars*/ 
            : new Set(strVal.split(",").map(v=>stringToValue(v,allowAmpersand)));
        //integer
        if(strMode == "i") return parseInt(strVal);
        return strVal;
    }

    return str;
}
stringToValue.stringLiterals = {
    "false":true,
    "false":false,
    "null":null,
    "undefined":undefined,
    "NaN":NaN,
}

/**
 * Filter construct
 * can be used for permissions
 * @returns {value|null}
 */

export class Filter {
    defaultValue = null;
    primitiveMap; regExpMap; functionMap; //Map<action:Function,data:value>
    get(k){
        if(this.primitiveMap.has(k)) return this.primitiveMap.get(k);

        if(typeof k == "string") 
            for (const [pattern,result] of this.regExpMap.entries()) {
                if(pattern.test(k)) return result;
            }
        for (const [action,data] of this.functionMap.entries()) {
            let res = action(k,data)
            if(res != null)return res; 
        }
        return this.defaultValue;
    }
    set(k,v){
        if(k instanceof RegExp){
            for (const [pattern,result] of this.regExpMap.entries()) {
                if(regexSame(k,pattern)){
                    this.regExpMap.set(pattern,v);
                    return this;
                }
            }
            //no match, add
            this.regExpMap.set(k,v);
            return this;
        }
        if (typeof k === "function"){
            this.functionMap.set(k,v);
            return;
        }
        this.primitiveMap.set(k,v);
        return;
    }
    constructor(imported,defaultVal){
        this.primitiveMap = new Map();
        this.regExpMap = new Map();
        this.functionMap = new Map();

        this.defaultValue = defaultVal ?? null;
        if(imported) for (const [k,v] of imported) {
            this.set(k,v);
        }

    }
    apon(fn){ 
        fn.call(this,this)
        return this;
    }
}

let [debug_flagWrite,debug_flagCreate,debug_flagBind] = Array(3).fill(false)

export const Flags = new class FlagsDatabase extends Map {
    get(k){
        let rtn = super.get(k);
        if(rtn) return rtn.value;
        return undefined;
    }
    set(k,v){
        this.assertFlag(k).value = v;
    }
    getFlag(k){
        return super.get(k);
    }
    assertFlag(k){
        if(super.has(k))return super.get(k);
        return new Flag(k);
    }
    declareFlag(k,v){
        if(super.has(k))throw new Error(`Flag ${JSON.stringify(k)} is already defined`);
        super.set(k,v);
    }
    test(k,input){
        return this.assertFlag(k).test(input);
    }
    apon(fn){ 
        fn.call(this,this)
        return this
    }
}

//remove the permission stuff from the object itself and
export class Flag extends Object {
    #value; setters
    constructor(name,defaultValue){
        super();
        if(debug_flagCreate)console.debug("flag-new:",name);
        let supermod;
        this.name = name
        if(supermod = Flags.getFlag(name)) return supermod;
        Flags.declareFlag(name,this);

        //may not be used
        this.#value = defaultValue
        this.setters = new Set();

    }
    get inevalue(){
        return this.#value;
    }
    set value(v){
        if(debug_flagWrite)console.debug("flag-write:",this.name,v);
        for (const setter of this.setters) setter.call(this,v,this.name);
        this.#value = v; 
    }

    set(k,v){
        
        if(this.#value == null) this.value = new Map();
        if(this.#value.set) return this.#value.set(k,v);
        throw new Error(this.name+': coersing value into an object with a "set" method would be destructive')
    }

    get(k){
        if(this.#value.get) return this.#value.get(k);
        return undefined;
    }

    add(v){
        if(this.#value == null) this.value = new Filter();
        if(this.#value.add) return this.#value.add(v);
        throw new Error(this.name+': coersing value into an object with a "set" method would be destructive');
    }
    
    delete(k){
        if(this.#value == null) return;
        if(this.#value.delete) return this.#value.delete(k);
        throw new Error(this.name+': coersing value into an object with a "delete" method would be destructive');
    }

    addSetterWatch(fn){
        if(debug_flagBind)console.debug("flag-bind:",this.name);
        this.setters.add(fn);
        fn.call(this,this.#value,this.name);
    }

    /**
     * set to result of callable if unset
     * @param {Function} callable 
     * @returns {Flag} self
     */
    defaultToFn(callable){
        //define if nullish
        if(this.#value == null) this.value = callable();
        return this
    }

    /**
     * set to value if unset
     * @param {any} value 
     * @returns 
     */
    defaultTo(value){
        if(this.#value == null) this.value = value;
        return this
    }
    /**
     * do this function with the context of this
     * (for syntax shugar)
     * @param {Function} fn 
     */
    apon(fn){ 
        fn.call(this,this)
        return this;
    }
}

new Flag("debug-flag-write",debug_flagWrite).addSetterWatch(v=>debug_flagWrite = v);
new Flag("debug-flag-create",debug_flagCreate).addSetterWatch(v=>debug_flagCreate = v);
new Flag("debug-flag-bind",debug_flagBind).addSetterWatch(v=>debug_flagBind = v);

if(debug_flagWrite || debug_flagCreate || debug_flagBind) console.debug("flags:","used debugging to capture its own flags changing");

/*
let demoFlag = false
new Flag("demo").addSetterWatch(v=>demoFlag = v);

Flags.set("demo",0);

console.log(demoFlag);

Flags.getFlag("demo").add("default:murder:.*");
Flags.getFlag("demo").add("resolve:memes:boots");


console.log(Flags.getFlag("demo").test("boots"))

console.log(stringToValue("l?uninstall,NaN"))

*/


(await import( "./flags-defaults.mjs")).flagsDefaults({
    stringToValue,Flag,Flags,regexSame,Filter, //add all exports here
})
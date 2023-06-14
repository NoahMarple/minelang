import { Flag } from "./flags.mjs";

//TODO: fix valueVars being writable

let regId = 0;


let TOKEN_WRITE_VOID;
new Flag("token-writeVoid").defaultTo(`write-void`).addSetterWatch(v=>TOKEN_WRITE_VOID=v);


export class BiliAssignmentDemand {
    //UNUSED? DEPRICATE
}

export class BiliVar {
    isInitlised = false; isWriteOpened = false; isReadOpened = false; birthLine = null; deathLine = null;
    readTimes = 0; writeTimes = 0;
    assertive = true; //value MUST be used as writable if supplied by assignTo
    assertCleanup = true; //when true: read/write operations must be "opened" to use and "closed" after use; as indicated by isReadOpened/isWriteOpened
    //when false: ability is indicated by isReadOpened/isWriteOpened
    isGlobalz = false; //globalz variables are not capable of getters/setters variables beginning with "@" are not nesisarly but usually globalz;
    constructor(engine, name, data) { 
        this.engine = engine;
        if(name !== null) this.name = name;
        this.data = data;
    }

    apply(newDat) {
        Object.apply(this, newDat);
        return this;
    }
    onExec(engine, astBlock, assignTo) {
        if(!this.isInitlised) throw new Error(`${this.name} is unset`);
        throw new Error(`${this.name} is not callable`);
    }

    async genaricPrepare(){
        //nop, use this or opening before reading state (like globalz);
    }

    openRead() {
        if(this.assertCleanup){
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:read-open)`);
        if (this.isReadOpened) throw new Error("engine-internals: redundant open-read of: " + this.name);
        if (this.isWriteOpened) throw new Error(`engine-internals: open-read of ${this.name} when already opened for writing`);
        this.isReadOpened = true;
        }
        if (this.birthLine == null) this.birthLine = this.engine.opCounter + 1; //done before placement, makes up for that
    }
    onRead() {
        this.readTimes++;
        if(!this.assertCleanup)return this;

        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:read)`);
        throw new Error(`${this.name} isnt readable`);
    }
    closeRead() {
        if(this.assertCleanup){
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:read-close)`);
        if (!this.isReadOpened) throw new Error("engine-internals: redundant close-read of: " + this.name);
        this.isReadOpened = false;
        }
        this.deathLine = this.engine.opCounter;
    }
    openWrite() {
        if(this.assertCleanup){
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:write-open)`);
        if (this.isWriteOpened) throw new Error("engine-internals: redundant open-write of: " + this.name);
        if (this.isReadOpened) throw new Error(`engine-internals: open-write of ${this.name} when already opened for reading`);
        this.isWriteOpened = true;
        }
        if (this.birthLine == null) this.birthLine = this.engine.opCounter + 1; //done before placement, makes up for that
    }
    onWrite() {
        this.writeTimes++;
        if(!this.assertCleanup)return this;

        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:write)`);
        throw new Error(`${this.name} isnt writable`);
    }
    closeWrite() {
        if(this.assertCleanup){
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:write-close)`);
        if (!this.isWriteOpened) throw new Error("engine-internals: redundant close-write of: " + this.name);
        this.isWriteOpened = false;
        }
        this.deathLine = this.engine.opCounter;
    }
    onReadReady(){
        this.readTimes++;
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:read)`);
        if (!this.isReadOpened) {
            if(!this.assertCleanup) throw new Error(`attempted to read from variable ${JSON.stringify(targVar.name)} does not implement reading`);
            throw new Error(`engine-internals:  ${this.name} is closed for reading`);
        } 
        return this;
    }
    onWriteReady(){
        this.writeTimes++;
        if(!this.isInitlised) throw new Error(`${this.name} is unset (attempt:write)`);
        if (!this.isWriteOpened) {
            if(!this.assertCleanup) throw new Error(`attempted to read from variable ${JSON.stringify(targVar.name)} does not implement reading`);
            throw new Error(`engine-internals:  ${this.name} is closed for writing`);
        }
        return this;
    }
    onStamp(op,i){
        throw new Error(`engine-internals: ${this.name} cannot be stamped`);
    }
}

export class BiliValueVar extends BiliVar {
    isInitlised = true;
    isWriteOpened = false;
    isReadOpened = true;
    assertive = false;
    assertCleanup = false;
    onRead() {
        return JSON.stringify(this.data);
    }
    toStatic() {
        return this.data;
    }
}

/**
 * arbitrary data holder, contains data not suited for genaric variable recevers
 */
export class BiliBlobVar extends BiliValueVar {
    onRead() {
        return `"*Blob(${this.name??""})*"`
    }
}

export class BiliRawVar extends BiliVar {
    constructor(engine, target) {
        super(engine, `raw(${target})`, target);
        //I dont think I need to register this var type;
    }
    assertCleanup = false;
    isInitlised = true;
    isWriteOpened = true;
    isReadOpened = true;
    assertive = true;
    onRead() {
        return `${this.data}`
    }
    onWrite() {
        return `${this.data}`
    }
    toStatic() {
        return undefined;
    }
}

export const VAR_NULL = {
    readTimes: 0,
    writeTimes: 0,
    isReadOpened:true,
    isWriteOpened:true,
    assertive: false,
    assertCleanup: false,
    onExec(engine, astBlock, assignTo) {
        return this;
    },
    onRead() {
        this.readTimes++;
        return `null`
    },
    onWrite() {
        this.writeTimes++;
        return TOKEN_WRITE_VOID
    },
    openRead() { },
    openWrite() { },
    closeRead() { },
    closeWrite() { },
    toStatic() {
        return null;
    },
    name: "null"
}

export const VAR_WANTS_REG = Object.create(VAR_NULL);
Object.assign(VAR_WANTS_REG, {
    onExec(engine, astBlock, assignTo) {
        throw new Error(`${this.name} is not executable`);
    },
    name: "var-wants-reg",
    onRead() {
        throw new Error(`${this.name} is not readable`);
    },
    onWrite() {
        throw new Error(`${this.name} is not writable`);
    },
    toStatic() {
        return undefined;
    },
});
export const VAR_WANTS_VAR = Object.create(VAR_WANTS_REG);
VAR_WANTS_VAR.name = "var-wants-var";


export const VAR_DEBUG = {
    onExec(engine, astBlock, assignTo) {
        console.debug("var: exec");
        return this;
    },
    onRead() {
        console.debug("var: read");
        return `null`
    },
    onWrite() {
        console.debug("var: write");
        return `write-void`
    },
    openRead() { console.debug("var: read-open"); },
    openWrite() { console.debug("var: write-open"); },
    closeRead() { console.debug("var: read-close"); },
    closeWrite() { console.debug("var: write-close"); },

    toStatic() {
        console.debug("var: to-static")
        return undefined;
    },
    get name() {
        console.debug("var: get-name");
        return `debug-var`;
    }
}

export class BiliRegister extends BiliVar {
    slotId = null;
    isInitlised = true;
    assertCleanup = true;
    constructor(engine, data) {
        
        super(engine, null, data)
        this.registerId = regId++;
        engine.varRegistery.add(this); //diffrent register than the BiliRegister
    }
    get name(){
        return `Register(${this.slotId !== null ? `name= _r${this.slotId}, ` : "" }id= ${this.registerId})`
    }
    set name(v){}
    onRead() {
        return this;
        //return `r${this.slotId}`
    }
    onWrite() {
        return this;
        //return `r${this.slotId}`
    }
    onOpStamp(op, i) {
        if (this.slotId == null) throw new Error(`engine-internals: ${this.name} was stampped ${this.wasBorn ? "before born" : "after death"}`);
        return `_r${this.slotId}`;
    }
    onBirth() {
        let slots = this.engine.registerSlots;
        let i = 0;
        while (slots[i]) i++;
        this.slotId = i;
        slots[i] = this;
    }
    onDeath() {
        let slots = this.engine.registerSlots;
        slots[this.slotId] = null;
    }
}

export class BiliGlobalzVar extends BiliVar {
    isGlobalz = true;
    assertCleanup = false;
    isReadOpened = true;
    isWriteOpened = true;
    onOpStamp(op,i){
        return this.data
    }
}
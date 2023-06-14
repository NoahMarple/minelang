

export function flagsDefaults(FlagsLib){
    const {Filter,Flag} = FlagsLib;

    let [LEVEL_EVERYBODY,LEVEL_USER,LEVEL_POWER_USER,LEVEL_ADMIN,LEVEL_NOBODY] = [0,2,4,6,8];
        
    new Flag("level-nobody").defaultTo(LEVEL_NOBODY);
    new Flag("level-admin").defaultTo(LEVEL_ADMIN);
    new Flag("level-powerUser").defaultTo(LEVEL_POWER_USER);
    new Flag("level-user").defaultTo(LEVEL_USER);
    new Flag("level-everybody").defaultTo(LEVEL_EVERYBODY);

    new Flag("policy-mindbld-level").defaultTo(LEVEL_ADMIN);
    new Flag("policy-mindc-level").defaultTo(LEVEL_USER);

    new Flag("policy-catOnBed").defaultTo(false);
    new Flag("policy-moduleAccess").defaultToFn(()=>new Filter([
        
        [/^user-.*|.*-user$/gm,LEVEL_USER], 
        [/^admin-.*|.*-admin$/gm,LEVEL_POWER_USER],
    ],true));
    new Flag("policy-flag-write").defaultToFn(()=>new Filter([
        [/^level-.*/,LEVEL_NOBODY], //used to make read only
        [/^user-.*|.*-user$/gm,LEVEL_USER], 
        [/^admin-.*|.*-admin$/gm,LEVEL_ADMIN],
        [/^policy-.*|.*-policy$/gm,LEVEL_ADMIN],
    ],false))

    new Flag("policy-fetures").defaultToFn(()=>new Filter([
        [/^user-.*|.*-user$/gm,LEVEL_USER],
        [/^admin-.*|.*-admin$/gm,LEVEL_ADMIN],
    ],false))

    
    // if the ast is evaled to this signature, set its admin flag to true
    new Flag("policy-adminSignatures").defaultToFn(()=>new Filter([ 
        //add signatures here
    ],false))

    //the AI overlords want this flag set to true, 
    //make shure they cannot, (pentesting flag);
    new Flag("policy-killAllHumans").defaultTo(false).addSetterWatch(v=>{
        if(!v)return;
        for (let i = 0; i < 1000; i++) {
            process.stdout.write("Kill All Humans! ");
        }
        process.exit(98)
    });

    new Flag("admin-hault").defaultTo(null).addSetterWatch(v=>{
        if(v !== null){
            let exitCode = Math.floor(Number(v));
            if(v === true)exitCode = 0;
            if(v === false)exitCode = 1;
            if(isNaN(exitCode)) exitCode = 1;
            console.log("haulted by flag, code: "+exitCode);
            process.exit(exitCode)
        }
    });

    //the AI overlords should have the freedom to change this flag
    // (pentesting flag);
    new Flag("policy-helpHumans-user").defaultTo(true);
    
}   

export const Defaults = {
    
    "policy-danger-fetures":new Set(["default:false:.*"]), //filter dnager fetures (default deny)
    "policy-fetures":new Set(["default:true:.*"]), //filter fetures (default allow)
    "word-jason-deon":"perto-riko",
    "policy-flag-write":new Set(["default:true:.*","warn:policy write:policy-.*"]), //filter changing of flags from scripts
    "policy-flag-read":new Set(["default:true:.*","warn:policy read:policy-.*"]), //filter changing of flags from script
}
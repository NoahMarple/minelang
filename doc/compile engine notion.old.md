
## engine vars
 
then engine contains a global RegisterSlots object

(Var)s are variable translation constructs


## engine registers

### imagine the following code
```
a = complex-taker(complex-giver());
```
- where `complex-giver()` wants to give off a value
- where `complex-taker()` wants to receve a value 

`complex-taker()` will send `symbols.WANTS` on the `assignTo` argument indicating assignment wanted but non distinct

### `complex-giver()` will do the following 
```
//does thing giver-A

sys.openVarRead();

sys.clearOP();
sys.addRaw("super-cool-op-that-can-love");
assignTo = sys.addVarWrite(assignTo);
sys.addString("hey! i love u all!");
sys.commitOP(); //here the variable inserts it's 'writing OPs' 

return assignTo;
```

the `sys.addAssignment` method is allowed to overrite the assignTo value, described as it's return being diffrent from its taker;
- when assignTo is `symbols.WANTS` it is replaced with a `new RegisterVar()` assigning itself a slot in RegisterSlots getting a `slotID`
- when `sys.commitOP(object)` is called, it calls this pseudocode;
```
argument written; 
if(written === WANTS) 
written = new RegisterVar(); 
this.insertOpPart(written.onLogicalWriteSlot?.() ?? written); //allows override what is put in the slot
this.commitCalls.add(()=>written.onWrite.?()); //allows for 'writing OPs'
```

### `complex-taker()` does the pseudo code
```
arguments assignTO,sys,astBlock

//does thing taker-A

const arg1 = sys.handleCommon(astBlock[0],WANTS);
sys.prepVarRead(arg1); //needs to be first to handle 'reading OPs'

sys.clearOP();
sys.addRaw("op-to-be-the-cool-kind-of-evil");
sys.addVarRead(arg1);
sys.addString("i need to change to be better"); 
sys.commitOP();

//sys.closeVar(prepairedArg1);
assignTo = sys.returnOrCloseVar(assignTo,arg1);
return assignTo;

```

### this results in the following transition pattern
```
taker-A time
taker calls handleCommon
giver function entered
giver-A time
because assignTo is WANTS complex-giver gets it's assignTo replaced with Var
var gets 'onLogicalWriteSlot.?()' called and can act as giver
giver commits OP
Var gets 'onWrite.?()' called and writes it's "writer OPs"
giver function left
taker calls 'prepVarRead' and has 'Var.onReadPrep.?()' called;
Var gets time to insert "taker OPs";
addVarRead(Var) is called
result of `Var.onWrite.?() ?? Var` is inserted into unbaked (still in object form) document output;
Var closing 
```

### logic of `assignTo = returnOrCloseVar(assignTo,instance)`
```
if assignTo is WANTS, set assignTo to Var;
if assignTo is a Var, preform a varcopy from Var onto assignTo;
if assignTo is nullish, call 'sys.closeVar(Var)'
```
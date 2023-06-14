# engine registers

NOTE: this is a prototype and is not written into the project get

## imagine the following code
```
a = complex-taker(complex-giver());
```
- where `complex-giver` wants to give off a value
- where `complex-taker` wants to receve a value 

## the psudocode for `complex-taker`
```
return async function (ast,sys,assignTo){

    let in0 = new Register();

    in0 = sys.commonHandle(ast.body[0],in0);

    await in0.openRead();
    //in0 is ready to read;

    let op = sys.newOP(); //preps to create new OP
    op.pushRaw("op-love-and-hugs"); //write OP
    await op.pushRead(in0); //fires this.pushRaw( in0.onWrite(op) );
    await op.toDocument();

    await in0.closeRead();

    return sys.VAR_NULL;
}
```
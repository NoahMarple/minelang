import util from 'util';



//BUG: semi colon can close brackets
//BUG: multi side arguments do not close and act like colon calls
//BUG: order of ops is screwed in general

export class CompileError extends Error {
  constructor(message,text,position) {
    super(message+" char:"+position); // (1)
    this.name = ""; // (2)
  }
}

export class CodeError {
  [util.inspect.custom](depth, options) {
    return this.toString();
  }
  constructor(message,pos) {
    this.message     = message
    this.dispMessage = message+"\n\n"
    this.stack = []
  }
  toString(){
    return this.dispMessage
  }
  stackAdd(name,comment){
    this.stack.push(name)
    this.dispMessage += name+(comment ?  ", "+comment : "")+"\n"
  }

}

export class buildAST {
  constructor(data) {
    let p = 0;
    let line = 1;
    let maxP = 0;

    let bytes = (amt, noadv) => {
      
      let l = data.substr(p, amt);
      let plite = p;
      for(const char of l){
        plite++;
        if(plite > maxP) {
           maxP = plite;
           if(char == "\n")line++;
        }
      }
      if (!noadv) p += amt;
        
      return l;
    };
    let isLetter = char => char.match(/[a-zA-Z]/);
    let isNumber = char => char.match(/[0-9]/);
    let isWord = char => char.match(/[0-9A-Za-z\-\_]/);
    let isStillNumber = char => char.match(/[0-9\.]/);


      /**
      * @param {bool} isTop
      * @param {bool} escOnSoftbreak cannot own a closing bracket
      * @returns {array}
      */

    this.body = function (argL,isTop, escOnSoftbreak,escOnStatement,writeParent) { 
      let softBreak = 0;
      let hardBreak = 0;
      let escNow = false;

      argL = argL || [];

      function onBreak(b,isHard){
        if(hardBreak <= 0) return; //if statement is undefined, some logic and return;
        switch (take(true).type) {
          //case "assignment":
        }
      }

      function write (obj){
        hardBreak++;
        softBreak++;
        if(escOnStatement && argL.length >= 1){ //mabe could take it to 2
          writeParent(obj);
          escNow = true;
        }
        obj.char = p;
        obj.line = line;
        argL.push(obj);
      }

      function take(noDec){
        if(softBreak <= 0)softBreak = 0;
        if(hardBreak <= 0)throw new Error(`lang-internals: attempted to take more than possable`);
        if(!noDec){
          hardBreak--;
          softBreak--;
        }
        return noDec ? argL[argL.length-1] : argL.pop();
      }


      bodyLoop: while (p <= data.length) {
        let flag1 = false;
        if(escNow) return argL;
        let b = bytes(1);
        switch (b) {
          case " ":
          case "\t":
            //OK
            //nop
            break;

          case "$":
              //TODO: add purpose
            write({type:"dollar"});
            break;
          case "@":
              //TODO: add purpose
              write({type:"at"});
            break;

          case ";":
            flag1 = true;
          case "\n":
          case ",":
            //OK
            {
              onBreak(b,flag1);
              softBreak = 0;
              if(flag1) hardBreak = 0;
              if(escOnSoftbreak) {
                p--;
                break bodyLoop;
              }
            }
            break;
          case ")":
            //OK
            if (isTop)
              throw new CompileError("attempted to close top level statement ", data, p);
            if(escOnSoftbreak)
              p--; //does not own the bracket
            break bodyLoop;

          case "/":
            //OK
            if (bytes(1, true) == "/") {
              this.comment();
            }
            else if (bytes(1, true) == "*") {
              this.longComment();
            }
            else {
              //TODO: catch
            }
            break;

          case "=":
            //TODO: fix
            {
              //using hardbreaks (ignoring softbreaks) allows for `a\n=b` to be valid despite the break
              if(hardBreak <= 0) throw new CodeError(`assignment missing left hand side`,line);

              

              write({type:"assignment",head:take(),body:this.body(null,false,true,true,write)});
            }
            break;
          case "(":
            //TODO: fix
            if(softBreak > 0){
              const l = take();

              if(l.type == "at"){
                write({type:"with",head:l,body:this.body(null,false,false,false,write)});
                
              }

              write({type:"call",head:l,body:this.body(null,false,false,false,write)});
              continue bodyLoop;
            }

            write({type:'block', body:this.body(null,false,false,false,write)});

            break;
          case "\"":
            write({type:"value",value:this.string()});
          break;

          case ":":
            {
              const left =  (hardBreak > 0) ? take() : {type:"word",value:"do"};

              if(bytes(1,true) === "="){
                bytes(1);
                write({type:"declaration",head:left,body:this.body(null,false,true,true,write)});  
                break;
              }

              write({type:"call",head:left,body:this.body(null,false,true,false,write)});
            }
          break;

          default:
            //TODO: fix
            if (isLetter(b)) {
              //OK
              p--; //undo taking b
              if(softBreak > 0){

              let l = take(true);
              if (l.type == "dollar") {
                take();
                write({type:"dollarWord",value:this.word()});
                continue bodyLoop;
              }
              
              if (l.type == "at") {
                take();
                write({type:"atWord",value:this.word()});
                continue bodyLoop;
              }

              }

                //default
                write({type:"word",value:this.word()});

            } else if (isNumber(b)) {
                p--; //undo taking b
                if(softBreak > 0){
  
                let l = take(true);
                if (l.type == "dollar") {
                  take();
                  write({type:"dollarNumber",value:this.number()});
                  continue bodyLoop;
                }
  
                }
  
                  //default
                  write({type:"value",value:this.number()});

            } else if (false) {
              //TODO: catch
            }

        }
      }

      return argL;
    };

    this.word = function () {
      let word = [];
      while (p <= data.length) {
        let b = bytes(1);
        if (isWord(b)) {
          word.push(b);
        }
        else {
          p--;
          break;
        }
      }
      return word.join("");
    };

    this.number = function () {
      let word = [];
      while (p <= data.length) {
        let b = bytes(1);
        if (isStillNumber(b)) {
          word.push(b);
        }
        else {
          p--;
          break;
        }
      }
      return Number(word.join(""));
    };
    this.comment = function () {
      while (p <= data.length) {
        let b = bytes(1);
        if (b != "\n") {
        }
        else {
          break;
        }
      }
      return;
    };
    this.string = function () {
      let word = [];
      while (p <= data.length) {
        let b = bytes(1);
        if (b != "\"") {
          word.push(b);
        }
        else {
          break;
        }
      }
      return word.join("");
    };

    this.longComment = function () {
      while (p <= data.length) {
        let b = bytes(1);
        if (b != "*") {
        }
        else {
          if (bytes(1, true) == "/") {
            break;
          }
        }
      }
      return;
    };


    return this.body(null,true,false,false,null);
  }
}
import Crypto from 'node:crypto'


export const MAGIC = Uint8Array([1,2,3,4,5]) //NOT FINAL

export const OPCODE = {
    //genarics
    INVALID_OBJ:0x00, END_0TERM:0x00, //SYN: <somthing...> <myop>
    END_OF:0x01, //end of an encapulating object SYN: <anyOp (type block)> ... <op END_OF>
    ARRAY:0x02, //genaric array type, SYN: <myop> ... <op END_OF>
    
    VOID:0x03, //parses but does declares null, SYN: <myop> <token>
    STRING_0TERM:0x04, //0 terminated construct string, SYN: <myop> <bytes...> <op END_OF>
    STRING_SHORT:0x05, //8 bit length, SYN: <myop> <length  8bit> <length bytes>
    STRING_LONG:0x06, //16 bit length, SYN: <myop> <length 16bit> <length bytes>
    STRING_HUGE:0x07, //64 bit length, SYN: <myop> <length 64bit> <length bytes>
    TRUE:0x08, 
    FALSE:0x09,
    NULL:0x0a,
    NUMBER_SHORT:0x0b, //8bit
    NUMBER_LONG:0x0c, //32 bit
    UNUSED:0x0d,
    NUMBER_FLOAT64:0x0d, //its stored like that, cant change it without loosing quality
    JSON_0TERM:0x0f, //usable as a fallback if need be
    
    //primitive constructor types
    DICT_ENTRY:0x11, //entry into a dictionary, SYN: <myop> <entryId 16bit> <token>
    DICT_USAGE:0x12, //use from dictionary,  SYN: <myop> <entryId 16bit>
    
    //DICT_ENTRY still returns a usage of the object, avoiding needing to use a DICT_USAGE next

    //types
    OBJ_CALL:0x13, //SYN: <myop> <token (head)> <op ARRAY> <body entries...> <op END_OF>
    OBJ_BLOCK:0x14, //SYN: <myop> <op ARRAY> <body entries...> <op END_OF>
    OBJ_WORD:0x15, //SYN: <myop> <token (coersed string)>; coerses numbers to `_r${number}`
    OBJ_ATWORD:0x16, //SYN: <myop> <token (coersed string)>
    OBJ_ASSIGNMENT:0x17, //SYN: <myop> <token "head"> <token "body">
    OBJ_DECLARATION:0x18, //SYN: <myop> <token "head"> <token "body">
    LINE_NUMBER:0x19, //SYN: <myop> <16bit "line">
    LINE_NEXT:0x1a, //SYN: <myop>
    LINE_ADV:0x1b, //SYN: <myop> <8bit "amount" (plus 2)>
    UNUSED:0x1c,
    UNUSED:0x1d,
    UNUSED:0x1e,
    UNUSED:0x1f,


    
    
}


/**
 * encode an AST
 * @param {object} ast
 * @param {array|none} result
 */
export function cerialASTencode(ast,result) {
    if(!result){ 
        result = [new Uint8Array(MAGIC)];    
    }
    //can now be used to store state info
    result = Object.create(result);
    result.toBuffer = function(){
        return Uint8Array.from()
    }
    result.dict = new Map();
    
    encode_genaric(ast,result);
    
    return 

}


function encode_genaric(ast,allowInvalid){
    switch(ast.type){
        
    }
}


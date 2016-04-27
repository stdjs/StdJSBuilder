var Std            = require("stdjs_node");
var module_fs      = require("fs");
var module_path    = require("path");
var module_uglify  = require("uglifyjs");
var module_miniCSS = require("mini-css");

/*
 * include files
*/
var includeFiles = function(sourceCode,basePath,callback){
    var $includeBegin = "/*[#include begin]";
    var $includeEnd   = "[#include end]*/";
    var includeTask   = function(){
        var endPos    = sourceCode.indexOf($includeEnd,beginPos);
        if(endPos == -1){
            return callback(sourceCode);
        }
        var filePaths = sourceCode.substring(beginPos + $includeBegin.length, endPos).trim().split("\n").each(function(i,fileName){
            if(!isEmpty(fileName = fileName.trim())){
                if(!isEmpty(basePath)){
                    basePath += "/";
                }else{
                    basePath = "";
                }
                return module_path.normalize(basePath + fileName);
            }
        },true);

        StdJSBuilder.mergeFiles(filePaths,function(text){
            sourceCode = sourceCode.left(beginPos) + text + sourceCode.substring(endPos + $includeEnd.length,sourceCode.length);
            if((beginPos = sourceCode.indexOf($includeBegin)) === -1){
                callback(sourceCode)
            }else{
                includeTask(beginPos,callback);
            }
        });
    };

    var beginPos = sourceCode.indexOf($includeBegin);
    if(!isFunction(callback)){
        callback = Std.func();
    }
    if(beginPos !== -1){
        includeTask(beginPos);
    }else{
        callback(sourceCode);
    }
};


/*
 * clear debug code
*/
var clearDebugCode = function(sourceCode){
    var beginStr    = "/*[#debug begin]*/";
    var endStr      = "/*[#debug end]*/";
    var beginPos    = 0;
    var currentPos  = 0;
    var releaseCode = "";

    while((beginPos = sourceCode.indexOf(beginStr,currentPos)) != -1){
        releaseCode += sourceCode.substring(currentPos,beginPos);

        var endPos = sourceCode.indexOf(endStr,beginPos);
        if(endPos == -1){
            releaseCode += sourceCode.substring(beginPos,sourceCode.length);
            break;
        }
        currentPos = endPos + endStr.length;
    }
    if(currentPos != sourceCode.length){
        releaseCode += sourceCode.substring(currentPos,sourceCode.length);
    }
    return releaseCode;
};

/*
 * replace keyword
*/
var replaceKeyword = function(sourceCode){
    var keywords = {
        "model":"a",
        "parent":"b",
        "events":"c",
        "mix":"d",
        "option":"e",
        "static":"f",
        "extend":"g",
        "private":"h",
        "protected":"i",
        "public":"j",
        "main":"k",
        "entrance":"l",
        "support":"m",
        "initialize":"n",
        "__constructor__":"z"
    };

    for(var name in keywords){
        sourceCode = sourceCode.replace(new RegExp(name,"g"),function(text,i){
            var defineText = "/*[#module option:" + text + "]*/";
            for(--i;i>0;i--){
                if(!Std.is.blankChar(sourceCode[i])){
                    break;
                }
            }
            if(sourceCode[i] === '/' && sourceCode.substring(i-defineText.length+1,i+1) === defineText){
                return keywords[name];
            }
            return text;
        });
    }
    return sourceCode;
};


/*
 * module
*/
var StdJSBuilder = Std.module({
    /*[#module option:static]*/
    static:{
        /*
         * minifyJS
        */
        minifyJS:function(sourceCode){
            return module_uglify.minify(replaceKeyword(sourceCode),{
                fromString: true
            }).code
        },
        /*
         * minifyCSS
        */
        minifyCSS:function(sourceCode){
            return module_miniCSS(sourceCode);
        },
        /*
         * read file
        */
        readFile:function(filePath,callback){
            return module_fs.readFile(filePath,function(error,data){
                if(isFunction(callback)){
                    callback.call(this,error,String(data));
                }
            });
        },
        /*
         * write file
        */
        writeFile:function(filePath,data,callback){
            return module_fs.writeFile(filePath,data,callback);
        },
        /*
         * clearDebugCode
        */
        clearDebugCode:function(text){
            return clearDebugCode(text);
        },
        /*
         * merge files
        */
        mergeFiles:function(inputFiles,outputFile,callback){
            var text  = "";
            var queue = new Std.queue({
                on:{
                    complete:function(){
                        if(isFunction(outputFile)){
                            outputFile(text);
                        }else if(isString(outputFile)){
                            module_fs.writeFile(outputFile,text,function(){
                                if(isFunction(callback)){
                                    callback(text);
                                }
                            });
                        }
                    }
                }
            });

            Std.each(inputFiles,function(i,filePath){
                queue.push(function(){
                    StdJSBuilder.readFile(filePath,function(error,data){
                        if(!error){
                            text += data;
                        }
                        queue.next();
                    });
                });
            });
            queue.start();
        },
        /*
         * head note text
        */
        headNoteText:function(sourceCode){
            if(sourceCode.left(2) === "/*"){
                return sourceCode.substring(0,sourceCode.indexOf("*/") + 2)
            }
            return "";
        },
        /*
         * rebuild
        */
        rebuild:function(sourceCode,debugMode,basePath,callback){
            includeFiles(sourceCode,basePath,function(text){
                if(debugMode !== true){
                    text = clearDebugCode(text);
                }
                if(isFunction(callback)){
                    callback(text);
                }
            });
        },
        /*
         * build JS code
        */
        buildJSCode:function(sourceCode,minify,debugMode,basePath,callback){
            var headerNote = StdJSBuilder.headNoteText(sourceCode);

            StdJSBuilder.rebuild(sourceCode,debugMode,basePath,function(text){
                if(minify === true){
                    text = headerNote + "\r\n" + StdJSBuilder.minifyJS(text)
                }
                if(isFunction(callback)){
                    callback(text);
                }
            });
        },
        /*
         * build CSS code
        */
        buildCSSCode:function(sourceCode,minify,debugMode,basePath,callback){
            var headerNote = StdJSBuilder.headNoteText(sourceCode);

            StdJSBuilder.rebuild(sourceCode,debugMode,basePath,function(text){
                if(minify === true){
                    text = headerNote + "\r\n" + StdJSBuilder.minifyCSS(text)
                }
                if(isFunction(callback)){
                    callback(text);
                }
            });
        },
        /*
         * build JS file
        */
        buildJSFile:function(inputPath,outputPath,minify,debugMode,callback){
            StdJSBuilder.readFile(inputPath,function(error,sourceCode){
                !error && StdJSBuilder.buildJSCode(sourceCode,minify,debugMode,module_path.dirname(inputPath),function(code){
                    module_fs.writeFile(outputPath,code,function(error,code){
                        if(!error && isFunction(callback)){
                            callback(code);
                        }
                    });
                });
            });
        },
        /*
         * build CSS file
        */
        buildCSSFile:function(inputPath,outputPath,minify,debugMode,callback){
            StdJSBuilder.readFile(inputPath,function(error,sourceCode){
                !error && StdJSBuilder.buildCSSCode(sourceCode,minify,debugMode,module_path.dirname(inputPath),function(code){
                    module_fs.writeFile(outputPath,code,function(error,code){
                        if(!error && isFunction(callback)){
                            callback(code);
                        }
                    });
                });
            });
        }
    },
    main:function(){

    }
});

/*
 * exports
*/
module.exports = StdJSBuilder;
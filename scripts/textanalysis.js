"use strict"

var typeindex = 0;
var nodetypes = ["person", "project", "skill", "deliverable", "objective"];
var suggestionChange=false;
var sentenceStack = [];
var typeStack = [];

var ExecutionStack = [];

var lastnode;

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_LINK = 'ANALYSIS_LINK';

function TextAnalyser2(graph, newtext, finalize) {
    var segment = [],
        subsegment = [],
        sentence = [];
    var newlinks = [];
    var newnodes = [];
    var linkindex = 0;
    var nodeindex = 0;
    var orderStack = [];
    var quoteword = "";
    var ANDcase = false;
    var ANDcount = 0;
    var prefix = "";
    var ret = {};

    //Sentence Sequencing
    //Build the words and cuts the main elements
    segment = newtext.split("#");
    for (var j = 0; j < segment.length; j++) {
        if (j !== 0) sentence.push("#");
        subsegment = segment[j].split(" ");
        if (subsegment.length === 0) {
            sentence.push(" ");
        }
        for (var k = 0; k < subsegment.length; k++) {
            if (subsegment[k] !== " " && subsegment[k] !== "") {
                if (subsegment[k].charAt(0) === '"') {
                    quoteword = "";
                    do {
                        quoteword += subsegment[k] + " ";
                        if(subsegment[k].charAt(subsegment[k].length-1) !== '"')k++;
                    } while (k < subsegment.length && subsegment[k].charAt(subsegment[k].length - 1) !== '"');
                     if(subsegment[k])if(subsegment[k]!==quoteword.replace(/ /g, ""))quoteword += subsegment[k];
                    sentence.push(quoteword.replace(/"/g, ""));
                } else {
                    sentence.push(subsegment[k]);
                }
            }
        }
    }

    //BUILD NEW NODE AND LINK ARRAYS WITH ORDER OF APPEARENCE
    for (var m = 0; m < sentence.length; m++) {
        switch (sentence[m]) {
            case "#":
                orderStack.push("START");
                break;
            case "and":
            case "+":
            case ",":
            case "&":
                sentence[m]=" and ";
                ANDcount++;
                //orderStack.push("AND");
            default:
                if (orderStack[orderStack.length - 1] === "START") {
                    orderStack.push("NODE");
                    newnodes.push(sentence[m]);
                    linkindex++;
                } else if (orderStack[orderStack.length - 1] === "NODE") {
                    orderStack.push("LINK");
                    if (!newlinks[linkindex]) {
                        newlinks[linkindex] = sentence[m] + " ";
                    } else {
                        newlinks[linkindex] += sentence[m] + " ";
                    }
                } else {
                    if (!newlinks[linkindex]) {
                        newlinks[linkindex] = sentence[m] + " ";
                    } else {
                        newlinks[linkindex] += sentence[m] + " ";
                    }
                }
                if (newnodes.length === 0) prefix += sentence[m] + " ";
                break;
        }
    }

    //ATTACH SENTENCE PREFIX
    if (prefix) newlinks[1] += "(" + prefix + ")";

    //WRITE COMPLETE SENTENCE
    linkindex = 0;
    nodeindex = 0;
    var word = "";
    var completeSentence = "";
    for (var m = 0; m < orderStack.length; m++) {
        if (orderStack[m] === "NODE") {
            word += " (" + newnodes[nodeindex] + ") ";
            if(newnodes[nodeindex].split(" ").length>1){
                completeSentence += '"'+newnodes[nodeindex]+'"' + " ";
            }else{
                completeSentence += newnodes[nodeindex] + " ";
            }
            nodeindex++;
        } else if (orderStack[m] === "LINK") {
            linkindex++;
            word += " -->" + newlinks[linkindex] + " --> ";
            completeSentence += newlinks[linkindex];
        }
    }

    //REBUILD GRAPH
    linkindex = 0;
    nodeindex = 0;

    //CHANGE TO PERMANENT STATE AND UPDATE SUGGESTIONLIST
    var typesetter = "";
    if (finalize === true) {
        typesetter = "perm";
        var sugg = []
        for (var n = 0; n < newnodes.length; n++) {
            if (Unique(newnodes[n])) {
                if(newnodes[n].split(" ").length>1){
                    sugg.push('"'+newnodes[n]+'"');
                }else{
                    sugg.push(newnodes[n]);
                }
                
            }
        }
        sugg.push(text);
        ret.sugg = sugg;
    } else {
        typesetter = "temp";
    }

    //REINITIALISE GRAPH (DUMB BUT IT WORKS)
    graph.removeNodes("temp");
    graph.removeLinks("temp");

    //ADD SURROUNDING BUBBLE
    if (orderStack.length > 0) {
        graph.addNode("", "bubble", "temp");
    }

    var abnormalGraph = (newlinks.length - ANDcount) >= 3;

    //0-N ORDER STACK
    for (var m = 0; m < orderStack.length - 1; m++) {
        switch (orderStack[m]) {
            case "START":
                if (!typeStack[nodeindex]) {
                    typeStack[nodeindex] = nodetypes[typeindex];
                }
                break;
            case "NODE":
                graph.addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
                if (!abnormalGraph) graph.addLink(newnodes[nodeindex - 1], newnodes[nodeindex], newlinks[linkindex], typesetter);
                nodeindex++;
                break;
            case "LINK":
                linkindex++;
                break;
        }
    }

    //FINAL N ORDER
    switch (orderStack[orderStack.length - 1]) {
        case "START":
            typeStack[nodeindex]=nodetypes[typeindex];
            graph.addNode("new node", typeStack[nodeindex], "temp");
            if (!abnormalGraph){graph.addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
            ANDconnect("new node");}
            ret.state = ANALYSIS_NODE_START;

            break;
        case "NODE":
            typeStack[nodeindex]=nodetypes[typeindex];
            graph.addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
            if (!abnormalGraph) {
                graph.addLink(newnodes[nodeindex - 1], newnodes[nodeindex], newlinks[linkindex], typesetter);
                ANDconnect(newnodes[nodeindex]);
            }
            break;
        case "LINK":
            linkindex++;
            graph.addNode("new node", "empty", "temp");
            if (!abnormalGraph){ graph.addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
            ANDconnect("new node");}
            ret.state = ANALYSIS_LINK;
            break;
    }

    //EXTERNAL AND CONNECTION CHECKING
    var verb = "";
    function ANDconnect(node) {
          for(var x=0;x<newlinks.length;x++){
            if(newlinks[x])if(newlinks[x].replace(/ /g,"")!=="and"){
                verb=newlinks[x];
                for(var y=0; y<x ;y++){
                    graph.addLink(newnodes[y],node,verb,typesetter);
                    for(var z=x; z<newnodes.length ;z++){
                        graph.addLink(newnodes[y],newnodes[z],verb,typesetter);
                    }
                }
                
            }
        }


    }

    /*console.log(sentence);
    console.log(completeSentence);
    console.log(orderStack);*/

    //STAR CASE
    verb = "";
    if (abnormalGraph) {
        for (var l = 1; l < newlinks.length; l++) {
            if (newlinks[l])
                if (newlinks[l].replace(/ /g, "") !== "and") {
                    verb = newlinks[l];
                }
        }
        graph.addNode(completeSentence, "chainlink", typesetter);
        for (var n = 0; n < newnodes.length; n++) {
            graph.addLink(newnodes[n], completeSentence, "", typesetter);
        }
    }

    //FOR THE EXTERNAL ARROW-TYPE CHANGER
    lastnode = newnodes[nodeindex];

    if(finalize){
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
    }

    //UPDATE GRAPH ONCE
    graph.update();

    return ret;
}



function Unique(newnode) {
    var truth = true;
    for (var p = 0; p < sugg.length; p++) {
        if (sugg[p] === newnode) {
            truth = false;
        }
    }
    return truth;
}

"use strict"

var text = "";
var sugg = ["AJAX", "Neo4J", "Rhizi", "Research", "CRI", "SageBionetworks", "Hero.coli", "CSS", "NodeJS", "HTML5", "Angular", "D3", "ProofOfConcept", "Graphs", "CloudComputing", "BigData", "ProblemSolving", "PHP", "Javascript", "BackBone", "Cooperation", "SemanticWeb"];
var typeindex = 0;
var names = ["Jean-ChristopheThalabard", "MaévaVignes", "AbdelElAbed", "ValérieTaly", "SébastienDutreuil", "AntoineBERGEL", "AntoineAngot", "JérômeFeret", "CharlèneGayrard", "HugoJimenezPerez", "CaterinaUrban", "GaëlleChevalon", "IanMarcus", "AntoineTALY", "ChantalLOTTON", "Ana-MariaLennon-Duménil", "FrédériqueCarlier-Grynkorn", "PascalMartin", "TamaraMilosevic", "NicolasCarpi", "StéphaneDaoudy", "DanijelaMaticVignjevic", "EugenioCinquemani", "VincentDAHIREL", "MartinLenz", "MaïlysChassagne", "AnneSchmidt", "SophieSacquinMora", "Richard-EmmanuelEastes", "MichelMorange", "EwaZlotek-Zlotkiewicz", "A.m.o.d.s.e.nC.h.o.t.i.a", "AlexandreVaugoux", "AnnemiekJMCornelissen", "ClémentNizak", "AntoineFrenoy", "ArielB.Lindner", "BenjaminBrogniart", "ChristopheZimmer", "ClaireRibrault", "DavidTareste", "DenisLafeuille", "DorGarbash", "DusanMISEVIC", "EddaNitschke", "FrançoisTaddei", "GregoryBatt", "JeanLucLebrun", "JesseHimmelstein", "KevinLhoste", "LauraCiriani", "LivioRiboli-Sasco", "NathalieSussfeld", "JakeEdwinWintermute", "MarlyneNogbou", "MatthieuPiel", "PascalHersen", "Pierre-YvesBourguignon", "TimoBetz", "RaphaëlGoujet", "StéphaneDebove", "VincentDanos", "TamKienDuong"];
var nodetypes = ["person", "project", "skill", "deliverable", "objective"];
var suggestionChange=false;
var sentenceStack = [];
var nodeindex, linkindex;
var typeStack = [];

var ExecutionStack = [];

var lastnode;

$('#textanalyser').autocompleteTrigger({
    triggerStart: '#',
    triggerEnd: '',
    source: sugg
});


$("#textanalyser").keypress(function(e) {
     if (e.which == 13) {
        if(!suggestionChange){
            text = $('#textanalyser').val();
            $('#textanalyser').val("");
            TextAnalyser2(text, true);
            typeStack=[];
        }else{
            suggestionChange=false;
        }

    return false;
    }

    if (e.which == 37) {//RIGHT

        $('body').scrollLeft(0);
        e.stopPropagation();
        return false;
    }
    if (e.which == 39) { //LEFT

        $('body').scrollLeft(0);
        e.stopPropagation();
        return false;
    }

});

$(document).keydown(function(e) {
  

    if (e.keyCode == 9) {//TAB
        e.preventDefault();
        changeType("down", lastnode);
        return false;
    }

    if (e.keyCode == 37) {//UP
          $('html, body').scrollLeft(0);
    }
    if (e.keyCode == 39) {//DOWN
          $('html, body').scrollLeft(0);
    }

    if (e.keyCode == 38) {//UP
        suggestionChange=true;
    }
    if (e.keyCode == 40) {//DOWN
        suggestionChange=true;
    }

    if (e.keyCode == 9) {//TAB
        return false;
    }

});


function textSelect(inp, s, e) {
        e = e || s;
        if (inp.createTextRange) {
            var r = inp.createTextRange();
            r.collapse(true);
            r.moveEnd('character', e);
            r.moveStart('character', s);
            r.select();
        }else if(inp.setSelectionRange) {
            inp.focus();
            inp.setSelectionRange(s, e);
        }
    }

function changeType(arg, id) {
    if (arg === 'up') {
        if (typeindex < 4) typeindex++;
        else typeindex = 0;
        graph.editType(id, null, nodetypes[typeindex]);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');
        graph.findCoordinates(lastnode,null);
    } else {
        if (typeindex > 0) typeindex--;
        else typeindex = 4;

        graph.editType(id, null, nodetypes[typeindex]);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');
        graph.findCoordinates(lastnode,null);

    }
    graph.updateGraph();
}

window.setInterval(function() {
    if ($('#textanalyser').val() != text) {

        if(text.length*8>500)$('#textanalyser').css('width',text.length*8+20);
        // text changed
        text = $('#textanalyser').val();
        TextAnalyser2(text, false);
        suggestionChange=false;
    }
}, 5);


function TextAnalyser2(newtext, finalize) {
    var states = ["NOTHING", "NEWNODE", "EDITNODE", "CLOSENODE", "NEWLINK", "EDITLINK", "SPECIAL", "QUARTET"];
    var segment = [],
        subsegment = [],
        sentence = [];
    var newlinks = [];
    var newnodes = [];
    linkindex = 0;
    nodeindex = 0;
    var orderStack = [];
    var quoteword = "";
    var ANDcase = false;
    var ANDcount = 0;
    var prefix = "";

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
                        k++;
                    } while (k < subsegment.length && subsegment[k].charAt(subsegment[k].length - 1) !== '"');
                    if (k < subsegment.length) quoteword += subsegment[k];
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
    } else {
        typesetter = "temp";
    }

    //REINITIALISE GRAPH (DUMB BUT IT WORKS)
    graph.removeNodes("temp");
    graph.removeLinks("temp");

    //ADD SURROUNDING BUBBLE
    if (orderStack.length > 0) graph.addNode("", "bubble", "temp");

    var abnormalGraph=false;
    if((newlinks.length- ANDcount)>=3 )abnormalGraph=true;

    //0-N ORDER STACK
    for (var m = 0; m < orderStack.length - 1; m++) {
        switch (orderStack[m]) {
            case "START":
                if(!typeStack[nodeindex])typeStack[nodeindex]=nodetypes[typeindex];
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
            $('.typeselection').css({top:window.innerHeight/2-115,left:window.innerWidth/2-325});
            $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>Use [TAB] key to pick a type</td></tr></table>');

            break;
        case "NODE":
            typeStack[nodeindex]=nodetypes[typeindex];
            graph.addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
            if (!abnormalGraph){ graph.addLink(newnodes[nodeindex - 1], newnodes[nodeindex], newlinks[linkindex], typesetter);
            ANDconnect(newnodes[nodeindex]);}
            break;
        case "LINK":
            linkindex++;
            graph.addNode("new node", "empty", "temp");
            if (!abnormalGraph){ graph.addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
            ANDconnect("new node");}

            $('.typeselection').css('top', -300);
            $('.typeselection').css('left', 0);
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
                        console.log(newnodes[y]+ " and "+newnodes[z]);
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

var text = "";
var opened = false;
var sugg = ["AJAX", "Neo4J", "Rhizi", "Research", "CRI", "SageBionetworks", "Hero.coli", "CSS", "NodeJS", "HTML5", "Angular", "D3", "ProofOfConcept", "Graphs", "CloudComputing", "BigData", "ProblemSolving", "PHP", "Javascript", "BackBone", "Cooperation", "SemanticWeb"];
var typeindex = 0;
var names = ["Jean-ChristopheThalabard", "MaévaVignes", "AbdelElAbed", "ValérieTaly", "SébastienDutreuil", "AntoineBERGEL", "AntoineAngot", "JérômeFeret", "CharlèneGayrard", "HugoJimenezPerez", "CaterinaUrban", "GaëlleChevalon", "IanMarcus", "AntoineTALY", "ChantalLOTTON", "Ana-MariaLennon-Duménil", "FrédériqueCarlier-Grynkorn", "PascalMartin", "TamaraMilosevic", "NicolasCarpi", "StéphaneDaoudy", "DanijelaMaticVignjevic", "EugenioCinquemani", "VincentDAHIREL", "MartinLenz", "MaïlysChassagne", "AnneSchmidt", "SophieSacquinMora", "Richard-EmmanuelEastes", "MichelMorange", "EwaZlotek-Zlotkiewicz", "A.m.o.d.s.e.nC.h.o.t.i.a", "AlexandreVaugoux", "AnnemiekJMCornelissen", "ClémentNizak", "AntoineFrenoy", "ArielB.Lindner", "BenjaminBrogniart", "ChristopheZimmer", "ClaireRibrault", "DavidTareste", "DenisLafeuille", "DorGarbash", "DusanMISEVIC", "EddaNitschke", "FrançoisTaddei", "GregoryBatt", "JeanLucLebrun", "JesseHimmelstein", "KevinLhoste", "LauraCiriani", "LivioRiboli-Sasco", "NathalieSussfeld", "JakeEdwinWintermute", "MarlyneNogbou", "MatthieuPiel", "PascalHersen", "Pierre-YvesBourguignon", "TimoBetz", "RaphaëlGoujet", "StéphaneDebove", "VincentDanos", "TamKienDuong"];
var nodetypes = ["person", "project", "skill", "deliverable", "objective"];
var previousorder = "NOTHING";
var nodecounter = 0;
var nodereplaced = false;

var newlink = "";

var ExecutionStack = [];

var lastnode;

$('#textanalyser').autocompleteTrigger({
    triggerStart: '#',
    triggerEnd: '',
    source: sugg
});

$('#textanalyser').submit(function () {
    //finalize text input, empty
    text=$('#textanalyser').val();

    $('#textanalyser').val("");
    TextAnalyser2(text,true);
    return false;
});

$(document).keydown(function (e) {
    //RIGHT
    if (e.keyCode == 37 ) {
        e.preventDefault();
        changeType("up",lastnode);
        return false;
    }

    //LEFT
    if (e.keyCode == 39 ) {
        e.preventDefault();
        changeType("down",lastnode);
        return false;
    }


    if (e.keyCode == 13) {
        text=$('#textanalyser').val();

        $('#textanalyser').val("");
        TextAnalyser2(text,true);

        return false;

    }
});

function changeType(arg,id) {
    if (arg === 'up') {
        if (typeindex < 4) typeindex++;
        else typeindex = 0;
        graph.editType(id, null, nodetypes[typeindex]);

        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');
    } else {
        if (typeindex > 0) typeindex--;
        else typeindex = 4;

        graph.editType(id, null, nodetypes[typeindex]);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');

    }
    graph.updateGraph();
}




window.setInterval(function () {
    if ($('#textanalyser').val() != text) {
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
        // text changed
        text = $('#textanalyser').val();
        TextAnalyser2(text,false);

    }
}, 5);






var sentenceStack = [];
var nodeindex,linkindex;

function TextAnalyser2(newtext,finalize) {
    var states = ["NOTHING", "NEWNODE", "EDITNODE", "CLOSENODE", "NEWLINK", "EDITLINK" , "SPECIAL" , "QUARTET"];
    var segment = [], subsegment = [], sentence = [];
    var newlinks=[];linkindex=0;
    var newnodes=[];nodeindex=0;
    var orderStack = [];
    var quoteword="";
    var ANDcase=false;
    var prefix="";

    //Sentence Sequencing
    //Build the words and cuts the main elements
    segment=newtext.split("#");
    for(var j=0;j<segment.length;j++){
        if(j!==0)sentence.push("#");
        subsegment=segment[j].split(" ");
        if(subsegment.length===0){
            sentence.push(" ");
        }
        for(var k=0;k<subsegment.length;k++){
            if(subsegment[k]!==" " && subsegment[k]!==""){
                if(subsegment[k].charAt(0)==='"'){
                    quoteword="";
                    do{
                        quoteword+=subsegment[k]+" ";
                        k++;
                    }while(k<subsegment.length && subsegment[k].charAt(subsegment[k].length-1)!=='"');
                    if(k<subsegment.length)quoteword+=subsegment[k];
                    sentence.push(quoteword.replace(/"/g, ""));
                }else{
                    sentence.push(subsegment[k]);
                }
            }
        }
    }
   
    for(var m=0;m<sentence.length;m++){
        switch(sentence[m]){
            case "#":
            orderStack.push("START");
            break;
            case "and": case "+": case ",":
            //orderStack.push("AND");
            default:
            if(orderStack[orderStack.length-1]==="START"){
                orderStack.push("NODE");
                newnodes.push(sentence[m]);
                linkindex++;
            }else if(orderStack[orderStack.length-1]==="NODE"){
                orderStack.push("LINK");

                if(!newlinks[linkindex]){newlinks[linkindex]=sentence[m]+" "; }
                else{ newlinks[linkindex]+=sentence[m]+" ";}
            }else{
                if(!newlinks[linkindex]){newlinks[linkindex]=sentence[m]+" "; }
                else{ newlinks[linkindex]+=sentence[m]+" ";}
            }   
            if(newnodes.length===0)prefix+=sentence[m]+" ";         
            break;
        }
    }
    if(prefix)newlinks[1]+="("+prefix+")";

    //WRITE COMPLETE SENTENCE
    linkindex=0;
    nodeindex=0;
    var word="";
    var completeSentence="";
    for(var m=0; m<orderStack.length;m++){
        if(orderStack[m]==="NODE"){
            word+=" ("+newnodes[nodeindex]+") ";
            completeSentence+=newnodes[nodeindex]+" ";
            nodeindex++;
        }else if(orderStack[m]==="LINK"){
            linkindex++;
            word+=" -->"+newlinks[linkindex]+" --> ";
            completeSentence+=newlinks[linkindex];
        }
    }

    //REBUILD GRAPH
    linkindex=0;
    nodeindex=0;

    var typesetter="";
    if(finalize===false)typesetter="temp";
    else typesetter="perm";

    graph.removeNodes("temp");
    graph.removeLinks("temp");

    if(orderStack.length>0)graph.addNode("","bubble","temp");
    //0-N ORDER STACK
    for(var m=0; m<orderStack.length-1;m++){
        switch(orderStack[m]){
        case "NODE":
            graph.addNode(newnodes[nodeindex],nodetypes[typeindex],typesetter);
            if(newnodes.length<4)graph.addLink(newnodes[nodeindex-1],newnodes[nodeindex],newlinks[linkindex],typesetter);
             ANDcase=ANDconnect(newnodes[nodeindex]);
            nodeindex++;
            break;
        case "LINK":
            linkindex++;
        break;
        }
    }

    //FINAL N ORDER
    switch(orderStack[orderStack.length-1]){
        case "START":
            graph.addNode("new node",nodetypes[typeindex],typesetter);
            if(newnodes.length<4)graph.addLink(newnodes[nodeindex-1],"new node",newlinks[linkindex],typesetter);
            ANDcase=ANDconnect("new node");
        break;
        case "NODE":
            graph.addNode(newnodes[nodeindex],nodetypes[typeindex],typesetter);
            if(newnodes.length<4)graph.addLink(newnodes[nodeindex-1],newnodes[nodeindex],newlinks[linkindex],typesetter);
            ANDcase=ANDconnect(newnodes[nodeindex]);
        break;
        case "LINK":
            linkindex++;
            graph.addNode("new node","empty",typesetter);
            if(newnodes.length<4)graph.addLink(newnodes[nodeindex-1],"new node",newlinks[linkindex],typesetter);
            ANDcase=ANDconnect("new node");
        break;
    }

    function ANDconnect(node){
        if(newlinks[linkindex-1])if(newnodes[nodeindex-2])if(newlinks[linkindex-1].replace(/ /g, "")=="and" && newlinks[linkindex].replace(/ /g, "")!=="and"){
                if(newnodes.length<4)graph.addLink(newnodes[nodeindex-2],node,newlinks[linkindex],typesetter);
                return true;
        }
    }

    //STAR CASE
    var verb="";
    if(newnodes.length>=4){
        for(var l=1;l<newlinks.length;l++){
            if(newlinks[l])if(newlinks[l].replace(/ /g,"")!=="and"){
                verb=newlinks[l];
            }
        }
        graph.addNode(completeSentence,"chainlink",typesetter);
        for(var n=0;n<newnodes.length;n++){graph.addLink(newnodes[n],completeSentence,verb,typesetter);}
    }
    
    lastnode=newnodes[nodeindex];
    //UPDATE GRAPH ONCE
    graph.update();   
}
/*









function TextAnalyser(newtext) {
    var states = ["NOTHING", "NEWNODE", "EDITNODE", "CLOSENODE", "NEWLINK", "EDITLINK"];
    var order = previousorder;
    var nodetype = "new";
    var array = [];
    var arraytext = "";

    var newnode = "";
    var index = newtext.length;


    array = newtext.match(/([#]\w+)/g);
    for (var i = nodecounter - 1; i <= nodecounter; i++) {
        if (addednodes[i] !== undefined) newlink = newtext.replace(addednodes[i], "");
        newlink = newlink.replace("#", "");
    }



    var lastchar = newtext.charAt(newtext.length - 1);
    switch (lastchar) {
        case " ":
        if (previousorder === "NEWNODE") order = "CLOSENODE";
        if (previousorder === "EDITNODE") order = "CLOSENODE";
        if (previousorder === "NEWLINK") order = "EDITLINK";
        break;

        case "#":
        if (previousorder === "NEWNODE") order = "EDITNODE";
        else if (previousorder === "EDITNODE") order = "EDITNODE";
        else order = "NEWNODE";
        break;

        default:
        if (previousorder === "NEWNODE") order = "EDITNODE";
        if (previousorder === "CLOSENODE") order = "NEWLINK";
        if (previousorder === "NEWLINK") order = "EDITLINK";
        break;
    }

    //console.log(order);

    //ORDER CYCLE
    previousorder = order;
    var lol = "";
    for (var k = 0; k < addednodes.length; k++) {
        lol += k + " " + addednodes[k] + "|";
    }
    console.log(lol);


    //edit words
    switch (order) {
        case "NOTHING":
        newnode = "";
        break;
        case "NEWNODE":
        newnode = "";
        break;
        case "EDITNODE":
        do {
            newnode = newtext.charAt(index) + newnode;
            newnode = newnode.replace(/\s/g, '');
            index--;
        } while (newtext.charAt(index) !== "#" && index > 0);
        break;
        case "CLOSENODE":
        do {
            newnode = newtext.charAt(index) + newnode;
            newnode = newnode.replace(/\s/g, '');
            index--;
        } while (newtext.charAt(index) !== "#" && index > 0);
        break;
        case "NEWLINK":

        newlink = "";

        break;
        case "EDITLINK":
        newnode = "";
        break;
    }


    //$('.debug').html("node n "+nodecounter+" state: "+order+" nodename: |"+newnode+ "| link: |"+newlink+"| lastnode: |"+addednodes[nodecounter-2]+"rep: "+nodereplaced);


    switch (order) {
        case states[0]:
        window.setTimeout(function () {
            $('#textanalyser').css('box-shadow', '0 0 0px #303030')
        }, 200);
        break;
        case states[1]:


        if (nodecounter % 2 === 0) {
            graph.addNode("", nodetypes[typeindex], "temp");
        } else {
            graph.addNode("", nodetypes[typeindex], "temp");
        }
        graph.editType("x", "temp", nodetypes[typeindex]);
        nodecounter++;
        break;
        case states[2]:
        if (nodereplaced === true) {
            //graph.removeLink();
            //graph.addLink
            graph.addNode(newnode, nodetypes[typeindex], "temp");
            graph.editLinkTarget(addednodes[nodecounter - 2], replacement, newnode);
            replacement = "";
        }
        nodereplaced = false;
        if (AddedUnique(newnode)) {

        } else if (nodecounter % 2 === 0) {
            console.log("not unique, replace");
            graph.addLink(addednodes[nodecounter - 2], newnode, newlink, "temp");
            graph.removeNode("x", "temp");
            nodereplaced = true;
            replacement = newnode;
        }
        graph.editName("x", "temp", newnode);
        graph.findCoordinates("x", "temp");
        break;
        case states[3]:

        nodereplaced = false;
        graph.editState("x", "temp", "perm");
        addednodes.push(newnode);
        if (Unique(newnode)) sugg.push(newnode);

        if (nodecounter % 2 === 0) {

            $('#textanalyser').css('box-shadow', '0 0 30px #FFFF8F');
            $('#textanalyser').val("");
            graph.removeNode("x", "temp");
            previousorder = states[0];
            newnode = "";
        }
        break;
        case states[4]:
        graph.addNode("", "empty", "temp");
        graph.addLink(addednodes[nodecounter - 1], "", newlink, "perm");
        break;
        case states[5]:
        graph.editLink(addednodes[nodecounter - 1], "", newlink);
        break;
    }



}

*/


function Unique(newnode) {
    truth = true;
    for (var p = 0; p < sugg.length; p++) {
        if (sugg[p] === newnode) {
            truth = false;
        }
    }
    return truth;
}
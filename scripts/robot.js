var sentence="";
sentence+=" #Rhizibot is showing you a #tutorial|";
sentence+="#Rhizi visualizes data with #Graphs and #relationships|";
sentence+="#links and #nodes have #context and #meaning|";

sentence+="#entities and #concepts are #nodes|";
sentence+="We built this entire graph in 30 seconds, try it out yourself!";
/*
sentence="";
var arr=["works on","contibutes to","likes","knows","is an expert at","donates to"];
var arr2=["is used by","is liked by","employs"];
for(var a=0;a<10;a++){
  if(Math.random()>0.5){
    sentence+="#"+names[Math.floor(Math.random()*names.length)]+" "+arr[Math.round(Math.random()*4)]+" #"+sugg[Math.floor(Math.random()*sugg.length)]+" ";
  }else{
    sentence+="#"+sugg[Math.floor(Math.random()*sugg.length)]+" "+arr2[Math.round(Math.random()*2)]+" #"+names[Math.floor(Math.random()*names.length)]+" ";
  
  }
}*/


var counter=0;
var sentencecounter=0;
var robot;
var speed=2;
$('.logo').click(function(){

setTimeout( Robot, 1000 );


});

/*var answer = confirm ("Would you like a tutorial?")
if (answer)
setTimeout( Robot, 100 );*/




function Robot(){
    
      
    if(counter<=sentence.length){
      var text=$('#textanalyser').val();
         counter++;
      if(sentence.charAt(counter)!=="|"){
      $('#textanalyser').val(text+sentence.charAt(counter));
        //if(Math.random()>0.9)graph.editType("x","temp",nodetypes[Math.round(Math.random()*4)]);

        if(sentence.charAt(counter)==="#"){
          sentencecounter++;
          window.setTimeout( Robot, 30/speed+Math.random()*160/speed );
        }else{
          window.setTimeout( Robot, 50/speed+Math.round(Math.random()*100/speed) );
        }
    }else{
       $('#textanalyser').trigger("submit");
          window.setTimeout( Robot, 650/speed );
    }
    }else{
        window.clearInterval(robot);
    }
    

      
 
}





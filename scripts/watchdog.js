
var oldtext;
$('#textanalyser').keyup(function(){

	var counter=$('#textanalyser').val().match(/([#])/g);
	if(counter.length>2){
		$('#textanalyser').val(oldtext);
	}
	oldtext=$('#textanalyser').val();

});



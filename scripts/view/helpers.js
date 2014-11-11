define(function() {
function customColor(type) {
    var color;
    switch (type) {
        case "person":
            color = '#FCB924';
            break;
        case "project":
            color = '#009DDC';
            break;
        case "skill":
            color = '#62BB47';
            break;
        case "deliverable":
            color = '#202020';
            break;
        case "objective":
            color = '#933E99';
            break;
        case "empty":
            color = "#080808";
            break;
        case "chainlink":
            color = "#fff";
            break;
        case "bubble":
            color = "rgba(0,0,0,0.2)";
            break;
        default:
            console.log('bug: unknown type ' + type);
            color = '#080808';
            break;
    }
    return color;
}

return {
    customColor: customColor,
};
});

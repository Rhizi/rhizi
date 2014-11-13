"use strict"

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

function customSize(type) {
    var size;
    switch (type) {
        case "person":
            size = 12;
            break;
        case "project":
            size = 12;
            break;
        case "skill":
            size = 12;
            break;
        case "deliverable":
            size = 12;
            break;
        case "objective":
            size = 12;
            break;
        case "empty":
            size = 9;
            break;
        case "chainlink":
            size = 8;
            break;
        case "bubble":
            size = 180;
            break;
        default:
            size = 9;
            break;
    }
    return size;
}


return {
    customSize: customSize,
    customColor: customColor,
};
});

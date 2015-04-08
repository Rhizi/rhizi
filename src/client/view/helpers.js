"use strict"

define(function() {
function customSize(type) {
    var size;
    switch (type) {
        case "person":
            size = 12;
            break;
        case "club":
            size = 12;
            break;
        case "skill":
            size = 12;
            break;
        case "internship":
            size = 12;
            break;
        case "interest":
            size = 12;
            break;
        case "empty":
            size = 9;
            break;
        case "chainlink":
            size = 8;
            break;
        default:
            size = 9;
            break;
    }
    return size;
}


return {
    customSize: customSize,
};
});

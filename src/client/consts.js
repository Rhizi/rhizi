"use strict"

define(function() {

    var description = {
        person: 'A person in CRI - student or teacher',
        club: 'A shared club or project within the CRI',
        skill: 'Ability or expertise you possess',
        interest: 'Scientific skill or domain expertise you wish you had',
        internship: "Title of first or second internship you've done"
    };

    // TODO: enums, sometime
    return {
        KEYSTROKE_WHERE_EDIT_NODE: 'keystroke_where_edit_node',
        KEYSTROKE_WHERE_DOCUMENT: 'keystroke_where_document',
        KEYSTROKE_WHERE_TEXTANALYSIS: 'keystroke_where_textanalysis',
        INPUT_WHERE_TEXTANALYSIS: 'input_where_textanalysis',
        description: description,
        NEW_NODE_NAME: 'new node',

        // Virtual Keycodes i.e. event.keyCode / event.key
        // https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#keys-keyvalues
        VK_UP: 38,
        VK_DOWN: 40,
        VK_ESCAPE: 27,
        VK_TAB: 9,
        VK_SPACE: 32,
        VK_ENTER: 13,
    };
});

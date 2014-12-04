"use strict"

define(function() {

    var nodetypes = ["person", "club", "skill", "interest", "third-internship-proposal", "internship"];

    var description = {
        person: 'Depict a person, real or fictional',
        club: undefined,
        skill: 'Depicts a specific ability of expertise a person can have',
        interest: undefined,
        'third-internship-proposal': undefined,
        internship: undefined,
    };

    // TODO: enums, sometime
    return {
        KEYSTROKE_WHERE_EDIT_NODE: 'keystroke_where_edit_node',
        KEYSTROKE_WHERE_DOCUMENT: 'keystroke_where_document',
        KEYSTROKE_WHERE_TEXTANALYSIS: 'keystroke_where_textanalysis',
        INPUT_WHERE_TEXTANALYSIS: 'input_where_textanalysis',
        nodetypes: nodetypes,
        description: description,
    };
});

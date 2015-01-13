"use strict"

define(function() {

    var nodetypes = ["person", "club", "skill", "interest", "third-internship-proposal", "internship"];

    var description = {
        person: 'A person in CRI - student or teacher',
        club: 'A shared club or project within the CRI',
        skill: 'Ability or expertise you possess',
        interest: 'Scientific skill or domain expertise you wish you had',
        'third-internship-proposal': 'Create this to submit your third internship proposal',
        internship: "Title of first or second internship you've done"
    };

    // TODO: enums, sometime
    return {
        KEYSTROKE_WHERE_EDIT_NODE: 'keystroke_where_edit_node',
        KEYSTROKE_WHERE_DOCUMENT: 'keystroke_where_document',
        KEYSTROKE_WHERE_TEXTANALYSIS: 'keystroke_where_textanalysis',
        INPUT_WHERE_TEXTANALYSIS: 'input_where_textanalysis',
        nodetypes: nodetypes,
        description: description,
        NEW_NODE_NAME: 'new node',
    };
});

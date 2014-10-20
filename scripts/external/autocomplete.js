/*
 *  autocompleteTrigger (based on jQuery-UI Autocomplete)
 *  https://github.com/experteer/autocompleteTrigger
 *
 * Copyright 2013, Experteer GmbH, Munich
 *
 * @version: 1.4
 * @author <a href="mailto:daniel.mattes@experteer.com">Daniel Mattes</a>
 *
 * @requires jQuery 1.6> and jQuery-Ui (including Autocomplete)  1.8>
 * @requires https://github.com/accursoft/caret
 *
 * @description
 * autocompleteTrigger allows you to specify a trigger (e. g. @ like twitter or facebook) and bind it to a textarea or input text field.
 * If a user writes the trigger-sign into the textbox, the autocomplete dialog will displayed and the text after the trigger-sign
 * will be used as search-query for the autocomplete options. If one of the suggested items will be selected, the value and trigger
 * will be added to the textfield.
 *
 * Thanks to https://github.com/kof/fieldSelection (getCursorPosition) and
 * http://stackoverflow.com/questions/4564378/jquery-autocomplete-plugin-that-triggers-after-token
 *
 * Dual licensed under MIT or GPLv2 licenses
 *   http://en.wikipedia.org/wiki/MIT_License
 *   http://en.wikipedia.org/wiki/GNU_General_Public_License
 *
 * @example
 * $('input').autocompleteTrigger({
 *   triggerStart : '@',
 *   triggerEnd: '',
 *   source: [
 "Asp",
 "BASIC",
 "COBOL",
 "ColdFusion",
 "Erlang",
 "Fortran",
 "Groovy",
 "Java",
 "JavaScript",
 "Lisp",
 "Perl",
 "PHP",
 "Python",
 "Ruby",
 "Scala",
 "Scheme"
 ]
 *  });
 */


define('autocomplete', ['jquery', 'jquery-ui', 'caret'], function(jQuery, __jqueryui, __caret) {
return function ($, window, document, undefined) {
  $.widget("ui.autocompleteTrigger", {

    //Options to be used as defaults
    options: {
      triggerStart: "%{",
      triggerEnd: "}"
    },


    _create: function () {
      this.triggered = false;

      this.element.autocomplete($.extend({

          search: function () {
            /**
             * @description only make a request and suggest items if acTrigger.triggered is true
             */
            var acTrigger = $(this).data("autocompleteTrigger") || $(this).data("uiAutocompleteTrigger");

            return acTrigger.triggered;
          },
          select: function (event, ui) {
            /**
             * @description if an item is selected, insert the value between triggerStart and triggerEnd
             */
            var acTrigger = $(this).data("autocompleteTrigger") || $(this).data("uiAutocompleteTrigger");
            var trigger = acTrigger.options.triggerStart;
            var cursorPosition = acTrigger.getCursorPosition();

            if ($(this).is('input,textarea')) {
              var text = $(this).val();
              var lastTriggerPosition = text.substring(0, cursorPosition).lastIndexOf(trigger);
              var firstTextPart = text.substring(0, lastTriggerPosition + trigger.length) +
                ui.item.value +
                acTrigger.options.triggerEnd;
              $(this).val(firstTextPart + text.substring(cursorPosition, text.length));
              acTrigger.setCursorPosition(firstTextPart.length);
            } else {
              var text = $(this).text();
              var html = $(this).html();
              var searchTerm = text.substring(0, cursorPosition);
              var i = 0;
              var index = 0;

              while (i < searchTerm.length) {
                index = html.lastIndexOf(searchTerm.substring(i));
                if (index != -1) {
                  break;
                }
                i++;
              }
//            console.log({html: html, index: index, searchTerm: searchTerm.substring(i) })

              var htmlCursorPosition = index + searchTerm.substring(i).length;
              var htmlLastTriggerPosition = html.substring(0, htmlCursorPosition).lastIndexOf(trigger);
              var htmlFirstTextPart = html.substring(0, htmlLastTriggerPosition + trigger.length) +
                ui.item.value +
                acTrigger.options.triggerEnd;
//            console.log({htmlCursorPosition: htmlCursorPosition, htmlLastTriggerPosition: htmlLastTriggerPosition, htmlFirstTextPart: htmlFirstTextPart })

              // necessary to set cursor position
              var lastTriggerPosition = text.substring(0, cursorPosition).lastIndexOf(trigger);
              var firstTextPart = text.substring(0, lastTriggerPosition + trigger.length) +
                ui.item.value +
                acTrigger.options.triggerEnd;
//            console.log({lastTriggerPosition: lastTriggerPosition, firstTextPart: firstTextPart, length: firstTextPart.length})

              $(this).html(htmlFirstTextPart + html.substring(htmlCursorPosition, html.length));
              acTrigger.setCursorPosition(firstTextPart.length);
            }

            acTrigger.triggered = false;
            return false;
          },
          focus: function () {
            /**
             * @description prevent to replace the hole text, if a item is hovered
             */

            return false;
          },
          minLength: 0
        }, this.options))

        .bind("keyup", function (event) {
          /**
           * @description Bind to keyup-events to detect text changes.
           * If the trigger is found before the cursor, autocomplete will be called
           */
          var widget = $(this);
          var acTrigger = $(this).data("autocompleteTrigger") || $(this).data("uiAutocompleteTrigger");
          var delay = typeof acTrigger.options.delay === 'undefined' ? 0 : acTrigger.options.delay;

          if (event.keyCode != $.ui.keyCode.UP && event.keyCode != $.ui.keyCode.DOWN) {
            if ($(this).is('input,textarea')) {
              var text = $(this).val();
            } else {
              var text = $(this).text();
            }

            acTrigger.textValue = text;
            if (typeof acTrigger.locked === 'undefined') {
              acTrigger.locked = false;
            }

            if (!acTrigger.locked) {
              acTrigger.locked = true;
              acTrigger.timeout = setTimeout(function () {
                acTrigger.launchAutocomplete(acTrigger, widget);
              }, delay);
            }
          }

        });
    },

    /**
     * @description Destroy an instantiated plugin and clean up modifications the widget has made to the DOM
     */
    destroy: function () {
      // this.element.removeStuff();
      // For UI 1.8, destroy must be invoked from the
      // base widget
      $.Widget.prototype.destroy.call(this);
      // For UI 1.9, define _destroy instead and don't
      // worry about
      // calling the base widget
    },

    /**
     * @description calculates the the current cursor position in the bound textfield, area,...
     * @returns {int}  the position of the cursor.
     */
    getCursorPosition: function () {
      var elem = this.element[0];
      return jQuery(elem).caret();
    },

    /**
     * @description set the position of the cursor in a textfield, area,...
     */
    setCursorPosition: function (position) {
      var elem = this.element[0];
      return jQuery(elem).caret(position);
    },

    launchAutocomplete: function (acTrigger, widget) {
      acTrigger.locked = false;
      var text = acTrigger.textValue;
      var textLength = text.length;
      var cursorPosition = acTrigger.getCursorPosition();
      var lastString;
      var query;
      var lastTriggerPosition;
      var trigger = acTrigger.options.triggerStart;
      var triggerEnd = acTrigger.options.triggerEnd;

      lastTriggerPosition = text.substring(0, cursorPosition).lastIndexOf(trigger);
      lastTriggerEndPosition = text.substring(0, cursorPosition).lastIndexOf(triggerEnd);

//      console.log('autocomplete: '+text+", lastTriggerPosition: "+lastTriggerPosition+", lastTriggerEndPosition: "+lastTriggerEndPosition + ", cursorPosition: "+cursorPosition);
      if ((lastTriggerEndPosition < lastTriggerPosition || textLength >= trigger.length)
          && lastTriggerPosition != -1) {
        query = text.substring(lastTriggerPosition + trigger.length, cursorPosition);
//        console.log('query '+query);
        acTrigger.triggered = true;
        widget.autocomplete("search", query);
      } else {
        acTrigger.triggered = false;
        widget.autocomplete("close");
      }
    }
  });
  return {autocomplete:'loaded, yay! just two hours wasted!'};
}(jQuery, window, document);
});

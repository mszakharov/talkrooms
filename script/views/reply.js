(function() {

    var form = $('#talk .talk-reply');
    var field = form.find('textarea');

    function send() {
        var content = field.val().trim();
        if (content) {
            Rest.messages.create({
                room_id: Room.data.room_id,
                content: content
            });
            field.val('').focus();
        } else {
            field.focus();
        }
    }

    form.find('.reply-send').on('click', function() {
        send();
    });

    form.on('submit', function(event) {
        event.preventDefault();
        send();
    });

    field.on('keypress', function(event) {
        if (event.which === 13 && !(event.altKey || event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            send();
        }
    });

    Room.replyTo = function(nickname) {
        var raw = field.get(0);
        var pos = raw.selectionStart;
        field.focus().val(nickname + ', ' + field.val());
        if ('setSelectionRange' in raw) {
            pos = pos ? pos + nickname.length + 2 : raw.value.length;
            raw.setSelectionRange(pos, pos);
        }
    };

})();

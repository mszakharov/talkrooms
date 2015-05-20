(function() {

    var messages = $.Rest('/api/messages');

    var form = $('#talk .talk-reply');
    var field = form.find('textarea');

    function send() {
        var content = field.val().trim();
        if (content) {
            messages.create({
                room_id: Room.data.room_id,
                content: content
            });
            field.val('').focus();
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

})();

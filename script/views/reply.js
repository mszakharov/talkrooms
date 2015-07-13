(function() {

    var form = $('#talk .talk-reply');
    var field = form.find('textarea');

    if (!(window.WebSocket && WebSocket.CLOSED === 3)) {
        form.hide();
        Room.replyTo = $.noop;
        return;
    }

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

    form.on('click', function() {
        field.focus();
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

    function showUserpic() {
        form.find('.userpic').css({
            backgroundImage: 'url(' + Userpics.getUrl(Room.socket) + ')',
            visibility: 'visible'
        });
    }

    Room.on('ready', showUserpic);

    Room.on('my.nickname.updated', function() {
        if (!Room.socket.userpic) showUserpic();
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

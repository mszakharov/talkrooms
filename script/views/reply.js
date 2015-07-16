(function() {

    var form = $('#talk .talk-reply');
    var field = form.find('textarea');
    var wrapper = form.find('.reply-wrapper');

    if (!(window.WebSocket && WebSocket.CLOSED === 3)) {
        form.hide();
        Room.replyTo = $.noop;
        return;
    }

    var recipient;

    function send() {
        var content = field.val().trim();
        if (content) {
            var options = {
                room_id: Room.data.room_id,
                content: content
            };
            if (recipient) {
                options.recipient_id = recipient.user_id;
                options.recipient_session_id = recipient.session_id;
                cancelPrivate();
            }
            Rest.messages.create(options);
            field.val('').focus();
        } else {
            if (recipient) {
                cancelPrivate();
            }
            field.focus();
        }
    }

    function cancelPrivate() {
        wrapper.removeClass('reply-private');
        recipient = null;
    }

    form.find('.reply-send').on('click', function() {
        send();
    });

    form.find('.reply-public').on('click', function() {
        cancelPrivate();
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
        if (event.which === 8 && recipient && !this.value) {
            cancelPrivate();
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
        if (!nickname) return field.focus();
        var raw = field.get(0);
        var pos = raw.selectionStart;
        field.focus().val(nickname + ', ' + field.val());
        if ('setSelectionRange' in raw) {
            pos = pos ? pos + nickname.length + 2 : raw.value.length;
            raw.setSelectionRange(pos, pos);
        }
    };

    Room.replyPrivate = function(data) {
        recipient = data;
        wrapper.find('.reply-recipient').html('&rarr; ' + data.nickname);
        wrapper.addClass('reply-private');
        field.focus();
    };

})();

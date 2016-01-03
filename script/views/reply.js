// Sending queue
(function() {

    var queue = [],
        current,
        overflow;

    function next() {
        if (current = queue.shift()) {
            send();
        } else if (overflow) {
            Room.trigger('replies.empty');
            overflow = false;
        }
    }

    function send() {
        Rest.messages.create(current).done(next).fail(retry);
    }

    function retry(xhr) {
        if (xhr.status === 429) {
            var delay = Number(xhr.responseText || 5);
            if (delay > 5) {
                Room.trigger('replies.overflow');
                overflow = true;
            }
            setTimeout(send, delay * 1000);
        } else {
            current = null;
        }
    }

    Room.on('connected', next);

    Room.send = function(data) {
        queue.push(data);
        if (!current) next();
        if (queue.length > 3) {
            Room.trigger('replies.overflow');
            overflow = true;
        }
    };

})();

// Reply form
(function() {

    var form = $('#talk .talk-reply');
    var field = form.find('textarea');
    var wrapper = form.find('.reply-wrapper');
    var sendButton = form.find('.reply-send');
    var recipient;

    if (!(window.WebSocket && WebSocket.CLOSED === 3)) {
        form.hide();
        Room.replyTo = $.noop;
        return;
    }

    function send() {
        var content = field.val().trim();
        if (content) {
            var options = {
                room_id: Room.data.room_id,
                content: content
            };
            if (recipient) {
                options.recipient_role_id = recipient.role_id;
                cancelPrivate();
            }
            Room.send(options);
            field.val('').focus();
        } else {
            if (recipient) {
                cancelPrivate();
            }
            field.focus();
        }
        if (expanded) {
            collapseField();
        }
    }

    function cancelPrivate() {
        wrapper.removeClass('reply-private');
        recipient = null;
    }

    sendButton.on('click', function() {
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

    field.on('keyup', function(event) {
        if (event.which === 38 && !this.value) {
            Room.editLast();
        }
    });

    var expanded;
    function collapseField() {
        var height = field.height();
        var container = field.parent();
        container.height(height);
        field.height('');
        container.animate({
            height: field.height()
        }, Math.round(height / 2) + 50, function() {
            container.height('');
        });
        expanded = false;
    }

    field.on('input', function(event) {
        if (this.scrollHeight > this.offsetHeight) {
            field.height(this.scrollHeight);
            expanded = true;
        } else if (expanded && !this.value) {
            collapseField();
        }
    });

    function showUserpic() {
        form.find('.userpic').css({
            backgroundImage: 'url(' + Userpics.getUrl(Room.socket) + ')',
            visibility: 'visible'
        });
    }

    Room.on('ready', showUserpic);

    Room.on('my.userpic.updated', showUserpic);

    Room.on('my.nickname.updated', function() {
        if (!Room.socket.userpic) showUserpic();
    });

    Room.on('replies.overflow', function() {
        sendButton.addClass('send-overflow');
    });

    Room.on('replies.empty', function() {
        sendButton.removeClass('send-overflow');
    });

    Room.on('leave', function() {
        sendButton.removeClass('send-overflow');
    });

    Room.reply = function() {
        field.focus();
    };

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

// Edit message
(function() {

    var form = $('.talk-edit');
    var field = form.find('textarea').val('');

    var editing;

    function showForm(message) {
        var id = message.attr('data-id');
        form.height(message.height());
        message.append(form);
        field.focus();
        Rest.messages.get(id).done(function(data) {
            form.parent('.message').addClass('editing');
            field.val(data.content);
            field.height(field[0].scrollHeight);
            form.height('');
            editing = data;
        });
    }

    function hideForm() {
        field.val('').height('');
        form.parent('.message').removeClass('editing');
        form.detach();
        editing = null;
    }

    function send() {
        var content = field.val().trim();
        if (content !== editing.content) {
            Talk.setContent(form.closest('.message'), content);
            Rest.messages
                .update(editing.message_id, {
                    content: content
                })
                .done(hideForm)
                .done(Room.reply);
        } else {
            hideForm();
        }
    }

    field.on('input', function(event) {
        var sh = this.scrollHeight;
        var oh = this.offsetHeight;
        if (sh > oh) {
            field.height(sh);
            $window.scrollTop($window.scrollTop() + sh - oh);
        }
    });

    field.on('keydown', function(event) {
        if (event.which === 13 && !(event.altKey || event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            send();
        }
        if (event.which === 27) {
            hideForm();
            Room.reply();
        }
    });

    field.on('blur', hideForm);
    Room.on('enter', hideForm);

    Room.edit = function(message) {
        hideForm();
        showForm(message);
    };

})();

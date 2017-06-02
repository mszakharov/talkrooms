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
        Rest.messages.create(current).done(next).fail(failed);
    }

    function retry(delay) {
        setTimeout(send, delay * 1000);
        if (delay > 5) {
            Room.trigger('replies.overflow');
            overflow = true;
        }
    }

    function failed(xhr) {
        if (xhr.status === 406) {
            notAcceptable(xhr.responseText);
        } else if (xhr.status === 429) {
            retry(Number(xhr.responseText || 5));
        } else {
            current = null;
        }
    }

    var link = /\b(http\S+[^.,)?!\s])/g;

    function notAcceptable(reason) {
        Room.replyFailed(current, reason);
        next();
    }

    Socket.on('connected', next);

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

    var form = $('.reply-form');
    var field = form.find('textarea');
    var wrapper = form.find('.reply-wrapper');
    var sendButton = form.find('.reply-send');
    var recipient;

    var $warning = $('.reply-warning');

    // Disable autofocus on mobile devices
    var autofocus = !(/android|blackberry|iphone|ipad|ipod|mini|mobile/i.test(navigator.userAgent));

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
            } else {
                options.mentions = getMentions(content);
            }
            Room.send(options);
            field.val('');
        } else if (recipient) {
            cancelPrivate();
        }
        if (autofocus) {
            field.focus();
        }
        if (expanded) {
            collapseField();
        }
        $warning.hide();
    }

    var mentionsIndex = {};

    function getMentions(content) {
        var mentions = [];
        var parts = content.split(', ');
        for (var i = 0; i < parts.length; i++) {
            var mention = mentionsIndex[parts[i]];
            if (mention) {
                if (mentions.indexOf(mention) === -1) {
                    mentions.push(mention);
                }
            } else if (mentions.length) {
                return mentions;
            }
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
        field.val('').focus();
        cancelPrivate();
    });

    form.on('click', function(event) {
        if (event.target !== userpic[0] && event.target !== field[0]) {
            field.focus();
        }
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

    var userpic = form.find('.userpic');

    function showUserpic() {
        userpic.css({
            backgroundImage: 'url(' + Userpics.getUrl(Room.myRole) + ')',
            visibility: 'visible'
        });
    }

    var screenKeyboard = 'ontouchstart' in window;

    userpic.on('click', function(event) {
        Profile.edit(this);
        // Screen keyboard overlays login links, don't show it
        if (!screenKeyboard) {
            $('#my-nickname').focus();
        }
    });

    Rooms.on('selected.ready', showUserpic);
    Rooms.on('selected.ready', function() {
        if (autofocus) field.focus();
    });

    Rooms.on('my.userpic.updated', showUserpic);

    Rooms.on('select', function() {
        $warning.hide();
        sendButton.removeClass('send-overflow');
        mentionsIndex = {};
    });

    Room.on('replies.overflow', function() {
        sendButton.addClass('send-overflow');
    });

    Room.on('replies.empty', function() {
        sendButton.removeClass('send-overflow');
    });

    Room.reply = function() {
        field.focus();
    };

    Room.replyTo = function(role) {
        var raw = field.get(0);
        var pos = raw.selectionStart;
        if (role && role.nickname) {
            mentionsIndex[role.nickname] = role.role_id;
            field.focus().val(role.nickname + ', ' + field.val());
            if ('setSelectionRange' in raw) {
                pos = pos ? pos + role.nickname.length + 2 : raw.value.length;
                raw.setSelectionRange(pos, pos);
            }
        } else {
            field.focus();
        }
    };

    Room.replyPrivate = function(data) {
        recipient = data;
        wrapper.find('.reply-recipient').html('&rarr; ' + data.nickname);
        wrapper.addClass('reply-private');
        field.focus();
    };

    Room.replyFailed = function(data, reason) {
        Room.trigger('reply.warning');
        $warning.show();
        field.on('input', hideWarning);
        if (!field.val()) {
            field.val(data.content);
        }
    };

    function hideWarning() {
        $warning.hide();
        field.off('input', hideWarning);
    }

    $window.on('focus', function() {
        if (autofocus) field.focus();
    });

})();

// Edit message
(function() {

    var form = $('.talk-edit');
    var field = form.find('textarea').val('');

    var $warning = form.find('.talk-edit-warning');

    var editing;

    function showForm(elem) {
        var node = elem[0];
        var data = Talk.getData(function(message) {
            return message.node === node;
        });
        elem.addClass('editing').append(form);
        field.focus().val(data.content);
        field.height(field[0].scrollHeight);
        editing = data;
    }

    function hideForm() {
        field.val('').height('');
        form.parent('.message').removeClass('editing');
        form.detach();
        $warning.hide();
        editing = null;
    }

    function send() {
        var content = field.val().trim();
        if (content !== editing.content) {
            Rest.messages
                .update(editing.message_id, {
                    content: content
                })
                .done(hideForm)
                .done(Room.reply)
                .fail(showWarning);
        } else {
            hideForm();
        }
    }

    function showWarning(xhr) {
        if (xhr.status === 406) {
            $warning.show();
            Talk.scrollBy($warning.outerHeight());
        } else {
            hideForm();
        }
    }

    field.on('input', function(event) {
        var sh = this.scrollHeight;
        var oh = this.offsetHeight;
        if (sh > oh) {
            field.height(sh);
            Talk.scrollBy(sh - oh);
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

// Random nickname hint
(function() {

    var hint = $('.nickname-hint'),
        userpic = $('.reply-form .userpic');

    function showHint(nickname) {
        hint.find('.nickname-hint-value').html(nickname);
        Room.on('message.created', hideByMessage);
        Room.on('reply.warning', hideHint);
        Profile.on('edit', hideHint);
        userpic.addClass('userpic-highlight');
        hint.show();
    }

    function hideHint() {
        hint.hide();
        userpic.removeClass('userpic-highlight');
        Room.off('message.created', hideByMessage);
        Room.off('reply.warning', hideHint);
        Profile.off('edit', hideHint);
        localStorage.setItem('nickname_hint_hidden', 1);
    }

    function hideByMessage(message) {
        if (Room.isMy(message)) hideHint();
    }

    hint.find('.nickname-hint-close').on('click', hideHint);

    Rooms.on('selected.ready', function(room) {
        if (Me.rand_nickname && window.localStorage && !localStorage.getItem('nickname_hint_hidden')) {
            showHint(room.myRole.nickname);
        }
    });

})();

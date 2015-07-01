// Profile
(function() {

    var sections = [];

    var popup = $.popup('#profile', function() {
        this.fadeIn(100);
    });

    function Section(selector, callback) {
        this.elem = $(selector);
        this.callback = callback;
    }

    Section.prototype.toggle = function(socket, me) {
        if (this.callback(socket, me)) {
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    function isMySocket(socket) {
        var uid = Room.socket.user_id;
        return uid ? (socket.user_id === uid) : (Room.socket.socket_id === socket.socket_id);
    }

    function show(socket_id, target) {
        var socket = Room.users.get(Number(socket_id));
        var me = isMySocket(socket);
        sections.forEach(function(section) {
            section.toggle(socket, me);
        });
        if (socket.user_id) {
            Rest.roles.get(Room.data.room_id + '/' + socket.user_id).done(loaded);
        }
        if (target) {
            var position = $(target).position();
            popup.css({
                top: position.top - 10,
                left: position.left > 20 ? position.left : 20
            });
        }
        popup.show();
    }

    function loaded(data) {
        Profile.trigger('loaded', data);
    }

    function hide() {
        popup.hide();
    }

    function updateIndexes() {
        var nodes = popup.find('.section').get();
        for (var i = nodes.length; i--;) {
            nodes[i].style.zIndex = nodes.length - i;
        }
    }

    updateIndexes();

    window.Profile = Events.mixin({
        sections: sections,
        add: function(selector, toggle) {
            sections.push(new Section(selector, toggle));
        },
        show: show,
        hide: hide
    });

})();

/* Edit nickname */
(function() {

    var field = $('#my-nickname');

    $('#profile-edit').on('submit', function(event) {
        event.preventDefault();
        var value = $.trim(field.val());
        if (value) {
            Rest.sockets.update(Room.socket.socket_id, {nickname: value}).done(Profile.hide);
        }
    });

    Profile.add('#profile-edit', function(socket) {
        if (Room.socket.socket_id === socket.socket_id) {
            field.val('').focus();
            field.val(socket.nickname);
            return true;
        } else {
            return false;
        }
    });

})();

/* User details */
(function() {

    var section = $('#profile-details');

    var types = /(facebook|vk|ok)/;
    var titles = {
        facebook: 'Профиль в Фейсбуке',
        vk: 'Профиль Вконтакте',
        ok: 'Профиль в Одноклассниках'
    };

    var link = '<a href="$1" target="_blank">$2</a>';
    function renderLink(url) {
        var type = url.match(types)[1];
        return String.mix(link, url, titles[type]);
    }

    Profile.add(section, function(socket, me) {
        if (me) return false;
        section.find('.details-nickname').html(socket.nickname);
        section.find('.details-link').html(socket.profile_url ? '…' : 'Без авторизации');
        section.find('.details-photo').remove();
        return true;
    });

    Profile.on('loaded', function(data) {
        if (section.is(':visible')) {
            section.find('.details-link').html(renderLink(data.profile_url));
            if (data.photo) {
                $('<img/>')
                    .addClass('details-photo')
                    .attr('src', '/photos/' + data.photo)
                    .prependTo(section);
            }
        }
    });

})();

/* Login and logout */
Profile.add('#profile-login', function(socket, me) {
    return me && !Room.socket.user_id;
});
Profile.add('#profile-logout', function(socket, me) {
    return me && Room.socket.user_id;
});

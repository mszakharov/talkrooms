// Profile
(function() {

    var popup = $.popup('#profile', function() {
        this.fadeIn(100);
    });

    function isMySocket(socket) {
        var uid = Room.socket.user_id;
        return uid ? (socket.user_id === uid) : (Room.socket.socket_id === socket.socket_id);
    }

    function show(socket, target) {
        var me = isMySocket(socket);
        popup.find('.section').hide();
        Profile.socket = socket;
        Profile.trigger('show', socket, me);
        if (target) {
            var position = $(target).offset();
            Profile.position = {
                top: position.top - 10 - $window.scrollTop(),
                left: position.left > 20 ? position.left : 20
            };
            Profile.fit();
        }
        popup.show();
        if (me) {
            Profile.trigger('ready', Room.myRole || {});
        } else if (socket.user_id) {
            Rest.roles.get(Room.data.room_id + '/' + socket.user_id).done(loaded);
        } else {
            Profile.trigger('ready', {});
        }
    }

    function loaded(data) {
        Profile.role = data;
        if (data.photo) {
            var img = new Image();
            img.src = '/photos/' + data.photo;
            img.onload = function() {
                Profile.trigger('ready', data, img);
            };
        } else {
            Profile.trigger('ready', data);
        }
    }

    function hide() {
        Profile.socket = null;
        Profile.tole = null;
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
        fit: function() {
            var wh = $window.height();
            var ph = popup.height();
            popup.css({
                top: Math.min(this.position.top, wh - ph - 20),
                left: this.position.left
            });
        },
        show: show,
        hide: hide
    });

})();

/* Edit nickname */
(function() {

    var form = $('#profile-edit');
    var field = $('#my-nickname');

    form.on('submit', function(event) {
        event.preventDefault();
        var value = $.trim(field.val());
        if (value) {
            Rest.sockets.update(Room.socket.socket_id, {nickname: value}).done(Profile.hide);
        }
    });

    Profile.on('show', function(socket, me) {
        if (me) {
            field.val(socket.nickname);
            form.show();
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

    Profile.on('show', function(socket, me) {
        if (me) return false;
        section.find('.details-nickname').html(socket.nickname);
        section.find('.details-link').html(socket.user_id ? 'Профиль…' : 'Без авторизации');
        section.find('.details-photo').remove();
        section.show();
    });

    Profile.on('ready', function(data, photo) {
        if (section.is(':visible')) {
            if (data.profile_url) {
                section.find('.details-link').html(renderLink(data.profile_url));
            }
            if (photo) {
                $(photo).addClass('details-photo').prependTo(section);
                Profile.fit();
            }
        }
    });

    Room.on('socket.nickname.updated', function(socket) {
        if (socket.socket_id === Profile.socket.socket_id) {
            section.find('.details-nickname').html(socket.nickname);
        }
    });

})();

/* Ignore */
(function() {

    var options = {
        url: '/script/views/ignore.js',
        dataType: 'script',
        cache: false
    };

    function checkLevel(role) {
        if (role && role.level >= 50) {
            $.ajax(options).done(loaded);
        }
    }

    function loaded() {
        Room.off('role.updated', checkLevel);
    }

    Room.on('role.updated', checkLevel);

})();

/* Login and logout */
(function() {

    var login = $('#profile-login'),
        logout = $('#profile-logout');

    Profile.on('show', function(socket, me) {
        if (me) (Room.socket.user_id ? logout : login).show();
    });

})();

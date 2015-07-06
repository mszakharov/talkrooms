/* Users cache */
Room.users = (function() {

    var sockets = new Collection({
        index: 'socket_id',
        order: 'nickname'
    });

    var showIgnored;

    function isMySocket(socket) {
        return socket.socket_id === Room.socket.socket_id;
    }

    function groupOnline(socket) {
        var uid = socket.user_id;
        if (uid) {
            if (uid === Room.socket.user_id) {
                return isMySocket(socket);
            } else {
                return this[uid] ? false : this[uid] = socket.online;
            }
        } else {
            return socket.online !== 0;
        }
    }

    function notIgnored(socket) {
        var ignored = socket.ignore && !Room.socket.ignore;
        if (ignored && showIgnored) this.push(socket);
        return !ignored;
    }

    function apply() {
        var ignore = [];
        var online = sockets.raw.filter(groupOnline, {});
        Room.trigger('users.updated', online.filter(notIgnored, ignore), ignore);
    }

    function getSockets() {
        return Rest.sockets.get({room_id: Room.data.room_id}).done(reset);
    }

    function reset(data) {
        sockets.raw = data;
        sockets.raw.forEach(setUserpicUrl);
        sockets.sort();
        apply();
    }

    function setUserpicUrl(socket) {
        socket.userpicUrl = Userpics.getUrl(socket);
    }

    function addSocket(socket) {
        if (!sockets.get(socket.socket_id)) {
            sockets.add(socket);
            setUserpicUrl(socket);
            apply();
        }
    }

    function removeSocket(socket) {
        sockets.remove(socket.socket_id);
        apply();
    }

    function simplePatch(data) {
        $.extend(sockets.get(data.socket_id), data);
        apply();
    }

    function complexPatch(data) {
        var socket = sockets.get(data.socket_id);
        $.extend(socket, data);
        setUserpicUrl(socket);
        if (data.nickname) {
            sockets.sort();
        }
        apply();
    }

    Room.on('enter', function(role) {
        this.promises.push(getSockets());
    });

    Room.on('role.updated', function(role) {
        showIgnored = role ? role.level >= 50 : false;
    });

    Room.on('socket.created', addSocket);
    Room.on('socket.deleted', removeSocket);

    Room.on('socket.online.updated', simplePatch);
    Room.on('socket.ignore.updated', simplePatch);

    Room.on('socket.nickname.updated', complexPatch);
    Room.on('socket.userpic.updated', complexPatch);

    return {
        get: function(socket_id) {
            return sockets.get(socket_id)
        }
    };

})();

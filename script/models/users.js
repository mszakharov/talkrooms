/* Users cache */
Room.users = (function() {

    var sockets = new Collection({
        index: 'socket_id',
        order: 'nickname'
    });

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

    function getSockets() {
        return Rest.sockets.get({room_id: Room.data.room_id}).done(reset);
    }

    function reset(data) {
        sockets.raw = data;
        sockets.raw.forEach(setUserpic);
        sockets.sort();
        apply();
    }

    function apply() {
        Room.trigger('users.updated', sockets.raw.filter(groupOnline, {}));
    }

    function setUserpic(socket) {
        if (!socket.userpic) {
            socket.userpic = getUserpic(socket.nickname);
        } else if (/^\d+\.png/.test(socket.userpic)) {
            socket.userpic = '/userpics/' + socket.userpic;
        }
    }

    function addSocket(socket) {
        if (!sockets.get(socket.socket_id)) {
            sockets.add(socket);
            setUserpic(socket);
            apply();
        }
    }

    function removeSocket(socket) {
        sockets.remove(socket.socket_id);
        apply();
    }

    Room.on('socket.created', addSocket);
    Room.on('socket.deleted', removeSocket);

    Room.on('socket.online', function(socket) {
        sockets.get(socket.socket_id).online = 1;
        apply();
    });

    Room.on('socket.offline', function(socket) {
        sockets.get(socket.socket_id).online = 0;
        apply();
    });

    Room.on('socket.nickname.updated', function(updated) {
        var socket = sockets.get(updated.socket_id);
        socket.nickname = updated.nickname;
        sockets.sort();
        setUserpic(socket);
        apply();
    });

    Room.on('socket.user_id.updated', function(updated) {
        var socket = sockets.get(updated.socket_id);
        $.extend(socket, updated);
        setUserpic(socket);
        apply();
    });

    Room.on('socket.userpic.updated', function(updated) {
        var socket = sockets.get(updated.socket_id);
        socket.userpic = updated.userpic;
        setUserpic(socket);
        apply();
    });

    return {
        load: getSockets
    };

})();

// Room
var Room = new Events;

// Enter a room
(function() {

    function admit(data) {
        Room.id = data.room_id;
        Room.data = data;
        Rest.sockets.create({hash: data.hash}).done(enter).fail(stop);
    }

    function enter(socket) {
        Room.socket = socket;
        Room.trigger('enter', socket);
        $.when.apply($, Room.promises).done(ready);
    }

    function ready() {
        Room.trigger('ready');
    }

    function stop(xhr) {
        if (xhr.status === 404) {
            Room.trigger('lost');
        } else if (xhr.status === 403) {
            Me.ready.done(locked);
        }
    }

    function locked() {
        var level = (Room.data && Room.data.level) || 0;
        if (level === 80) {
            Room.trigger('closed');
        } else if (Me.authorized && level >= 20) {
            Room.trigger('locked', true);
            Room.createRequest();
        } else {
            Room.trigger('locked');
        }
    }

    Room.enter = function(hash) {
        if (this.hash && this.hash !== hash) {
            this.leave();
        }
        this.hash = hash;
        Room.promises = [];
        Rest.rooms.get(hash).done(admit).fail(stop);
    };

    Room.leave = function() {
        Room.trigger('leave');
        if (Room.socket) {
            Rest.sockets.destroy(Room.socket.socket_id);
            Room.socket = null;
        }
        Room.data = null;
        Room.hash = null;
        Room.id = null;
    };

    $window.on('beforeunload', function(event) {
        Room.leave();
    });

})();

// Locked room request
(function() {

    var timer;
    var request_id;
    var counter;

    function getRequest() {
        clearTimeout(timer);
        Rest.requests.get(request_id).done(check);
    }

    function check(request) {
        if (request.approved) {
            Room.enter(Room.hash);
        } else if (request.approved == null) {
            checkLater();
        }
    }

    function checkLater() {
        timer = setTimeout(getRequest, counter++ > 6 ? 60000 : 15000);
    }

    function wait(data) {
        request_id = data.request_id;
        checkLater();
    }

    Room.on('leave', function() {
        clearTimeout(timer);
    });

    Room.createRequest = function() {
        counter = 0;
        Rest.requests.create({hash: Room.hash}).done(wait);
    };

})();

// Compare user, session and socket id with my socket
Room.isMy = function(data) {
    var my = this.socket;
    return Boolean(my &&
        my.socket_id === data.socket_id ||
        my.session_id === data.session_id ||
        my.user_id && my.user_id === data.user_id);
};

// Socket
(function() {

    var stream;
    var path = String.mix('wss://$1/sockets/', window.location.host);

    var timer,
        reconnectEvery = 10000,
        reconnectCount = 0,
        reconnectAfter = 0;

    var closedCount = 0;

    function connect() {
        reconnectEvery = 10000;
        reconnectCount = 0;
        stream = new WebSocket(path + Room.socket.token);
        stream.addEventListener('open', onOpen);
        stream.addEventListener('message', onMessage);
        stream.addEventListener('close', onClose);
    }

    function disconnect() {
        clearTimeout(timer);
        if (stream) {
            stream.removeEventListener('open', onOpen);
            stream.removeEventListener('message', onMessage);
            stream.removeEventListener('close', onClose);
            stream.close();
        }
        stream = null;
    }

    function reconnect() {
        clearTimeout(timer);
        if (reconnectCount++ > 5) {
            reconnectEvery = 60000;
        }
        Rest.sockets
            .get(Room.socket.socket_id)
            .done(connect)
            .fail(reconnectFailed);
    }

    function reconnectFailed(xhr) {
        if (xhr.status == 404) {
            Room.socket = null;
            Room.enter(Room.data.hash);
        } else {
            deferReconnect();
        }
    }

    function deferReconnect() {
        clearTimeout(timer);
        var now = (new Date).getTime();
        var delay = Math.max(0, reconnectAfter - now);
        reconnectAfter = now + delay + reconnectEvery;
        timer = setTimeout(reconnect, delay);
        console.log(String.mix('Reconnect in $1s', Math.round(delay / 1000)));
    }

    function onOpen() {
        closedCount = 0;
        console.log('Socket opened');
        Room.trigger('connected');
    }

    function onClose(event) {
        console.log(String.mix('Socket closed with $1, $2 errors', event.code, closedCount));
        Room.trigger('disconnected');
        if (closedCount++ > 5) {
            disconnect();
        } else if (event.code !== 1000 && Room.socket) {
            deferReconnect();
        }
    }

    function onMessage(message) {
        var event = JSON.parse(message.data);
        console.log(message.data);
        Room.trigger(event[0], event[1]);
    }

    if (window.WebSocket && WebSocket.CLOSED === 3) {
        Room.on('ready', connect);
        Room.on('leave', disconnect);
    }

})();

// Update room
(function() {

    function patch(data) {
        $.extend(Room.data, data);
    }

    Room.on('room.hash.updated', function(data) {
        Room.hash = data.hash;
        Router.replace(data.hash, Room.data.topic);
    });

    Room.on('room.topic.updated', patch);
    Room.on('room.hash.updated', patch);
    Room.on('room.searchable.updated', patch);
    Room.on('room.level.updated', patch);
    Room.on('room.min_session_created.updated', patch);

})();

// Delete room
Room.on('room.deleted.updated', function(data) {
    if (!data.deleted) return;
    if (Room.socket.level === 80) {
        Room.trigger('leave');
        Room.trigger('deleted');
    } else {
        Room.leave();
        Room.trigger('closed');
    }
})

// Update my nickname
Room.on('socket.nickname.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) {
        Room.socket.nickname = socket.nickname;
        Room.trigger('my.nickname.updated', socket);
    }
});

// Update my userpic
Room.on('user.userpic.updated', function(user) {
    if (Room.socket.user_id === user.user_id) {
        Room.socket.userpic = user.userpic;
        Room.trigger('my.userpic.updated', user);
    }
});

// Update my photo
Room.on('user.photo.updated', function(user) {
    if (Room.socket.user_id === user.user_id) {
        Room.socket.photo = user.photo;
    }
});

// Update my status
Room.on('socket.status.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) {
        Room.socket.status = socket.status;
    }
});

// Ignored
Room.on('session.ignored.updated', function(session) {
    if (Room.socket.session_id === session.session_id) {
        Room.socket.ignored = session.ignored;
    }
});

// Ignores
(function() {

    function isEmpty(ignores) {
        return $.isEmptyObject(ignores[0]) && $.isEmptyObject(ignores[1]);
    }

    function isActive(ignores) {
        return ignores && !Room.moderator && !isEmpty(ignores);
    }

    function inIgnores(data) {
        var ignores = Room.socket.ignores;
        return Boolean(data.user_id ?
            ignores[0][data.user_id] :
            ignores[1][data.session_id]);
    }

    function updateIgnores() {
        Room.ignores = isActive(Room.socket.ignores) ? inIgnores : false;
    }

    Room.on('user.ignores.updated', function(data) {
        Room.socket.ignores = data.ignores;
        updateIgnores();
    });

    Room.on('moderator.changed', updateIgnores);

})();


// Check permissions
(function() {

    function checkLevel() {
        var level = Room.socket.level || 0;
        setModer(level >= 50);
        setAdmin(level >= 70);
    }

    function setModer(on) {
        if (Room.moderator === on) return;
        if (Room.moderator = on) {
            $.require('views/moderate.js');
            $.require('views/settings.js');
        }
        Room.trigger('moderator.changed', on);
    }

    function setAdmin(on) {
        if (Room.admin === on) return;
        if (Room.admin = on) {
            $.require('views/roles.js');
        }
        Room.trigger('admin.changed', on);
    }

    Room.on('user.level.updated', function(data) {
        if (Room.socket.user_id === data.user_id) {
            Room.socket.level = data.level;
            checkLevel();
        }
    });

    Room.on('enter', checkLevel);

})();

// Create and shuffle
(function() {

    function changeRoom(data) {
        Router.push(data.hash);
    }

    Room.create = function() {
        return Rest.rooms.create().done(changeRoom);
    };

    Room.shuffle = function() {
        return Rest.rooms.create('search').done(changeRoom);
    };

})();

// Inactive window detection
(function() {

    $window.on('blur', function() {
        Room.idle = true;
    });

    $window.on('focus', function() {
        Room.idle = false;
    });

})();

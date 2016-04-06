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
        $.when.apply($, Room.promises).done(ready).fail(error);
        Rest.subscriptions.create({
            socket_id: socket.socket_id,
            hash: Room.data.hash
        }).done(saveSubscription);
    }

    function saveSubscription(subscription) {
        Room.subscription = subscription.subscription_id;
    }

    function ready() {
        Room.trigger('ready');
    }

    function error() {
        Room.trigger('error');
    }

    function stop(xhr) {
        switch (xhr.status) {
            case 406: Room.trigger('error', 'Пожалуйста, включите куки в вашем браузере.'); break;
            case 402: Room.trigger('error', 'Слишком много одновременных соединений.'); break;
            case 404: Room.trigger('lost'); break;
            case 403: locked(xhr); break;
            default: error();
        }
    }

    function locked(xhr) {
        var level = (Room.data && Room.data.level) || 0;
        if (level === 80) {
            Room.trigger('closed');
        } else {
            var data = xhr.responseJSON;
            if (data && data.role_id) {
                Room.trigger('locked', true);
                Room.wait(data);
            } else {
                Room.trigger('locked');
            }
        }
    }

    function getRoom() {
        Rest.rooms.get(Room.hash).done(admit).fail(stop);
    }

    Room.enter = function(hash) {
        if (this.hash && this.hash !== hash) {
            this.leave();
        }
        this.hash = hash;
        Room.promises = [];
        Me.load().done(getRoom).fail(error);
    };

    Room.leave = function() {
        Room.trigger('leave');
        if (Room.socket) {
            Rest.sockets.destroy(Room.socket.socket_id);
            Room.socket = null;
        }
        if (Room.subscription) {
            Rest.subscriptions.destroy(Room.subscription);
            Room.subscription = null;
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
    var role_id;
    var counter;

    function getRole() {
        clearTimeout(timer);
        Rest.roles.get(role_id).done(check);
    }

    function check(role) {
        if (role.come_in) {
            checkLater();
        } else if (role.come_in !== 0) {
            Room.enter(Room.hash);
        }
    }

    function checkLater() {
        timer = setTimeout(getRole, counter++ > 6 ? 60000 : 15000);
    }

    Room.on('leave', function() {
        clearTimeout(timer);
    });

    Room.wait = function(data) {
        counter = 0;
        role_id = data.role_id;
        checkLater();
    };

})();

// Compare role_id with my role
Room.isMy = function(data) {
    var my = this.socket;
    return Boolean(my && my.role_id === data.role_id);
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
    Room.on('room.watched.updated', patch);
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
Room.on('role.nickname.updated', function(role) {
    if (Room.socket.role_id === role.role_id) {
        Room.socket.nickname = role.nickname;
        Room.trigger('my.nickname.updated', role);
    }
});

// Update my status
Room.on('role.status.updated', function(role) {
    if (Room.socket.role_id === role.role_id) {
        Room.socket.status = role.status;
    }
});

// Ignored
Room.on('role.ignored.updated', function(role) {
    if (Room.socket.role_id === role.role_id) {
        Room.socket.ignored = role.ignored;
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

// Ignores
(function() {

    function isEmpty(ignores) {
        return $.isEmptyObject(ignores[0]) && $.isEmptyObject(ignores[1]);
    }

    function isActive(ignores) {
        return ignores && !Room.moderator && !isEmpty(ignores);
    }

    function inIgnores(data) {
        return Boolean(data.user_id ?
            Me.ignores[0][data.user_id] :
            Me.ignores[1][data.session_id]);
    }

    function updateIgnores(data) {
        Me.ignores = data.ignores;
        toggleIgnores();
    }

    function toggleIgnores() {
        Room.ignores = isActive(Me.ignores) ? inIgnores : false;
    }

    Room.on('me.ignores.updated', updateIgnores);
    Room.on('moderator.changed', toggleIgnores);
    Room.on('ready', toggleIgnores);

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

    Room.on('role.level.updated', function(data) {
        if (Room.socket.role_id === data.role_id) {
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

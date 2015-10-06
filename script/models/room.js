// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages')
};

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
        Room.promises = [];
        Room.socket = socket;
        Room.trigger('enter', socket);
        $.when.apply($, Room.promises).done(ready);
    }

    function ready() {
        Room.trigger('ready');
    }

    function stop(xhr) {
        if (xhr.status === 404 || xhr.status === 403) {
            Room.trigger('lost');
        }
    }

    Room.enter = function(hash) {
        if (this.hash && this.hash !== hash) {
            this.leave();
        }
        this.hash = hash;
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
    });

    Room.on('room.topic.updated', patch);
    Room.on('room.hash.updated', patch);
    Room.on('room.searchable.updated', patch);

})();

// Ignore
Room.on('session.ignored.updated', function(session) {
    if (Room.socket.session_id === session.session_id) Room.socket.ignored = session.ignored;
});

// Update my nickname
Room.on('socket.nickname.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) {
        Room.socket.nickname = socket.nickname;
        Room.trigger('my.nickname.updated', socket);
    }
});

// Update my status
Room.on('socket.status.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) {
        Room.socket.status = socket.status;
    }
});

// Require scripts depending on level
Room.loadForLevel = function(level, url) {

    function checkLevel() {
        var myLevel = Room.socket.level || 0;
        if (myLevel >= level) {
            $.require(url);
        }
    }

    Room.on('enter', checkLevel);

};

// Inactive window detection
(function() {

    $window.on('blur', function() {
        Room.idle = true;
    });

    $window.on('focus', function() {
        Room.idle = false;
    });

})();

// Router
(function() {

    var history = window.history;
    var defaultHash = 'chat30';

    function checkUrl() {
        var hash = location.hash.replace(/^#/, '');
        if (!hash) {
            hash = defaultHash;
            replaceState(hash);
        }
        if (hash !== Room.hash) {
            Room.enter(hash);
        }
    }

    function replaceState(hash, title) {
        history.replaceState({}, title || document.title, '#' + hash);
    }

    Room.on('room.hash.updated', function(data) {
        replaceState(data.hash, Room.data.topic);
    });

    $window.on('popstate', checkUrl);

    $(checkUrl);

    window.Router = {
        navigate: function(hash, title) {
            history.pushState({}, title || '', '#' + hash);
            checkUrl();
        }
    };

})();


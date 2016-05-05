// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    users:    $.Rest('/api/users'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    requests: $.Rest('/api/requests'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages'),
    subscriptions: $.Rest('/api/subscriptions')
};

// Router
(function() {

    var Router = {};
    var routes = [];

    var history = window.history;

    function checkUrl() {
        var hash = location.hash.replace(/^#/, '');
        if (hash !== Router.hash) {
            Router.hash = hash;
            processHash(hash);
        }
    }

    function processHash(hash) {
        for (var i = 0; i < routes.length; i++) {
            var match = routes[i].route.test(hash);
            if (match) {
                return routes[i].callback(hash);
            }
        }
    }

    $window.on('popstate hashchange', checkUrl);

    Router.on = function(route, callback) {
        routes.push({route: route, callback: callback});
    };

    Router.push = function(hash, title) {
        history.pushState({}, title || '', '#' + hash);
        checkUrl();
    };

    Router.replace = function(hash, title) {
        history.replaceState({}, title || document.title, '#' + hash);
    };

    $(checkUrl);

    window.Router = Router;

})();

Router.on(/^$/, function(hash) {
    Room.toggle(false);
    Room.leave();
});

Router.on(/^[\w\-+]{3,}$/, function(hash) {
    Room.enter(hash);
    Room.toggle(true);
});

// Me
var Me = {};

// Get my session
(function() {

    function update(data) {
        Me.authorized = Boolean(data.user_id);
        Me.ignores = data.ignores;
        Me.checkVersion(data.talkrooms);
        updateRooms(data);
    }

    function updateRooms(data) {
        Me.rooms = data.rooms || [];
        Me.recent_rooms = data.recent_rooms || [];
    }

    Me.update = function() {
        return Rest.sessions.get('me').done(update);
    };

    Me.ready = Me.update();

})();

// Talkrooms vesrion
(function() {

    var notice;
    var version = 33;

    function showNotice(description) {
        notice = $('<div class="updated-notice"></div>')
            .append('<div class="updated-title">Вышло обновление Talkrooms. Пожалуйста, <span class="updated-reload">обновите страницу</span>, чтобы сбросить кэш браузера.</div>')
            .append('<div class="updated-text">' + description + '</div>');
        notice.find('.updated-reload').on('click', function() {
            location.reload(true);
        });
        notice.appendTo('body')
            .css('top', -notice.outerHeight() - 20)
            .animate({top: 0}, 300);
    }

    Me.checkVersion = function(data) {
        if (data && data.version > version && !notice) showNotice(data.whatsnew);
    };

})();

// Socket
(function() {

    var Socket = Events.mixin({});

    var path = String.mix('wss://$1/sockets/', window.location.host),
        stream,
        token;

    var connectionTimer,
        connectionTries = 0,
        closedInstantly = 0;

    function getConnectionDelay(tries) {
        if (tries > 6) return 60;
        if (tries > 0) return 10;
        return 1;
    }

    function openSocket() {
        connectionTries = 0;
        if (window.WebSocket && WebSocket.CLOSED === 3) {
            stream = new WebSocket(path + token);
            stream.addEventListener('open', onOpen);
            stream.addEventListener('message', onMessage);
            stream.addEventListener('close', onClose);
        }
    }

    function disconnect() {
        clearTimeout(connectionTimer);
        if (stream) {
            stream.removeEventListener('open', onOpen);
            stream.removeEventListener('message', onMessage);
            stream.removeEventListener('close', onClose);
            stream.close();
        }
        stream = null;
    }

    function reconnect() {
        clearTimeout(connectionTimer);
        Rest.sockets.get(Socket.id)
            .done(openSocket)
            .fail(socketLost);
    }

    function socketLost(xhr) {
        if (xhr.status == 404) {
            Socket.ready = createSocket();
        } else {
            connectLater();
        }
    }

    function connectLater() {
        var tries = connectionTries++;
        var delay = closedInstantly > 1 ? getConnectionDelay(tries) : 5;
        connectionTimer = setTimeout(reconnect, delay * 1000);
    }


    Socket.ready = Me.ready.then(createSocket);

    function createSocket() {
        return Rest.sockets.create().done(socketCreated).fail(socketFailed);
    }

    function socketCreated(socket) {
        token = socket.token;
        Socket.id = socket.socket_id;
        Socket.trigger('created');
        openSocket();
    }

    function socketFailed(xhr) {
        Socket.trigger('error', xhr.status);
    }


    function onOpen() {
        closedInstantly = 0;
        Socket.connected = true;
        Socket.trigger('connected');
    }

    function onClose(event) {
        Socket.connected = false;
        Socket.trigger('disconnected');
        if (closedInstantly++ > 5) {
            disconnect();
        } else if (event.code !== 1000) {
            connectLater();
        }
    }

    function onMessage(message) {
        console.log(message.data);
        var event = JSON.parse(message.data);
        Socket.trigger(event[0], event[1]);
        Room.handleEvent(event);
    }

    Socket.subscribe = function(hash) {
        return Socket.ready.then(function() {
            return Rest.subscriptions.create({
                socket_id: Socket.id,
                hash: hash
            });
        });
    };

    $window.on('beforeunload', disconnect);

    window.Socket = Socket;

})();

// Login in other tab
Socket.on('me.user_id.updated', function() {
    Me.authorized = true;
    Me.update(); // update rooms and ignores
});

// Logout in other tab
Socket.on('me.deleted', function() {
    Me.authorized = false;
    if (Router.hash) {
        Router.push('');
    }
});

// Update rooms
Socket.on('me.recent_rooms.updated', function(data) {
    Me.recent_rooms = data.recent_rooms || [];
});
Socket.on('me.rooms.updated', function(data) {
    Me.rooms = data.rooms || [];
});

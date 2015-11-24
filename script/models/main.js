// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    users:    $.Rest('/api/users'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    requests: $.Rest('/api/requests'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages')
};

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

    window.Router = {
        navigate: function(hash, title) {
            history.pushState({}, title || '', '#' + hash);
            checkUrl();
        }
    };

    $(checkUrl);

})();

// Me
var Me = {};

// Get my session
Me.ready = Rest.sessions.create('me').done(function(data) {
    Me.authorized = Boolean(data.user_id);
});

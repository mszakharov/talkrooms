// Room list
(function() {

    var $hall = $('.hall');

    var recentList = new List($hall.find('.hall-recent')),
        myList     = new List($hall.find('.hall-my'));

    var subscribed = {};

    var roomTemplate = $.template('#room-template');

    function renderRoom(data) {
        var $room = roomTemplate(data);
        if (subscribed[data.hash]) {
            $room.addClass('room-subscribed');
        }
        return $room[0];
    }

    function List(elem) {
        this.elem = elem;
        this.list = elem.find('.rooms-list');
    }

    List.prototype.update = function(rooms) {
        this.list.empty();
        if (rooms.length || this === myList) {
            this.list.append(rooms.map(renderRoom));
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    function updateLists() {

        var isMy = {};
        Me.rooms.forEach(function(room) {
            isMy[room.hash] = true;
        });

        var recent = Me.recent_rooms.filter(function(room) {
            return !isMy[room.hash];
        });

        recentList.update(recent);
        myList.update(Me.rooms);

    }

    $('.hall-shuffle .link').on('click', function() {
        Rooms.shuffle();
    });

    $('.hall-create button').on('click', function() {
        var button = this;
        Rooms.create().catch(function() {
            $(button).hide();
            $('.hall-create-failed').show();
        });
    });

    Socket.on('me.recent_rooms.updated', updateLists);
    Socket.on('me.rooms.updated', updateLists);

    Rooms.on('explore', function() {
        $hall.show();
    });

    Rooms.on('select', function() {
        $hall.hide();
    });

    function toggleSubscribed(hash, isSubscribed) {
        var $room = $hall.find('.room[data-hash="' + hash + '"]');
        $room.toggleClass('room-subscribed', isSubscribed);
    }

    Socket.on('me.subscriptions.add', function(data) {
        subscribed[data.hash] = true;
        toggleSubscribed(data.hash, true);
    });

    Socket.on('me.subscriptions.remove', function(data) {
        delete subscribed[data.hash];
        toggleSubscribed(data.hash, false);
    });

    Me.ready.done(function() {
        Me.subscriptions.forEach(function(room) {
            subscribed[room.hash] = true;
        });
    });

    Me.ready.done(updateLists);

})();

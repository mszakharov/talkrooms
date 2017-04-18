// Room list
(function() {

    var $hall = $('.hall');

    var recentList = new List($hall.find('.hall-recent')),
        myList     = new List($hall.find('.hall-my'));

    var renderLink = Template($('#room-template').html());

    function List(elem) {
        this.elem = elem;
    }

    List.prototype.update = function(rooms) {
        this.elem.find('ul').remove();
        if (rooms.length) {
            this.elem.append('<ul>' + rooms.map(renderLink).join('') + '</ul>');
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

    $('.hall-shuffle > .link').on('click', function() {
        Room.shuffle();
    });

    $('.hall-create > button').on('click', function() {
        Room.create();
    });

    Socket.on('me.recent_rooms.updated', updateLists);
    Socket.on('me.rooms.updated', updateLists);

    Room.on('lists', function() {
        $hall.show();
    });

    Room.on('enter', function() {
        $hall.hide();
    });

    Me.ready.done(updateLists);

    Room.trigger('lists');

})();

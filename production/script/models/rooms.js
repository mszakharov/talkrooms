(function() {

    var Rooms = new Events();

    Rooms.view = function(state) {
        this.trigger('view', state);
    };

    window.Rooms = Rooms;

})();

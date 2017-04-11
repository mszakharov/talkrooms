function Events() {

    var events = {};

    this.on = function(type, callback) {
        events[type] = [callback].concat(events[type] || []);
    };

    this.off = function(type, callback) {
        var list = events[type];
        if (list) {
            list = list.concat();
            for (var i = list.length; i--;) {
                if (list[i] === callback) list.splice(i, 1);
            }
            events[type] = list;
        }
    };

    this.trigger = function(type) {
        var list = events[type];
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = list && list.length; i--;) {
            list[i].apply(this, args);
        }
    };

}

Events.mixin = function(target) {
    Events.call(target);
    return target;
};

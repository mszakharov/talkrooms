$.mockjax({
    url: '/api/rooms/garage/enter',
    status: 403,
    responseText: {
        role_id: 42
    }
});

$.mockjax({
    url: '/api/rooms/QWtcY8Pz/enter',
    status: 500
});

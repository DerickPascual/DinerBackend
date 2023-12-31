require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");
const { listRooms, createRoomId, roomExists } = require('./roomsManager');
const Room = require('./classes/Room');
const { getInitialRestaurants, getAdditionalRestaurants, getRestaurants } = require('./googleApiRestaurantsManager');
const { setTimeout } = require("timers/promises");

const app = express();
const cors = require('cors');
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        // add localhost for development
        origin: process.env.NODE_ENV === 'production' ? 'https://letsdiner.com' : 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    // add localhost for development
    origin: process.env.NODE_ENV === 'production' ? 'https://letsdiner.com' : 'http://localhost:3000'
}));

app.use(express.json());

app.get('/api/new-room-id', (req, res) => {
    const roomId = createRoomId(io);

    res.status(200).json({ roomId: roomId });
});

app.post('/api/check-room-id', (req, res) => {
    const { roomId } = req.body;

    if (roomExists(io, roomId)) {
        res.status(200).json({ message: "valid" });
        return;
    }

    res.status(403).json({ message: 'invalid' });
});

const Rooms = {};
const socketRooms = {};

io.on("connection", (socket) => {
    console.log("A socket has connected");

    socket.on("join_room", async (roomId, latitude, longitude, radius) => {
        if (!roomId) {
            socket.emit("restauraunts", []);
            return;
        }

        roomId = roomId.toUpperCase();

        if (roomExists(io, roomId)) {
            console.log(`A socket is joining existing room ${roomId}`);

            socket.join(roomId);
            Rooms[roomId].addMember(socket.id);

            if (!Rooms[roomId].restaurantsHaveDetails) {
                await setTimeout(1000);
            }

            socket.emit("existing_room_restaurants", Rooms[roomId].restaurants)

            console.log(`Socket successfully joined ${roomId}`);
        } else {
            console.log(`A socket is creating a room ${roomId}`);

            // add restauraunts
            const restaurantsObj = await getRestaurants(latitude, longitude, radius);
            const restaurants = restaurantsObj.restaurants;
            const queryLimitHit = restaurantsObj.queryLimitHit;
            
            Rooms[roomId] = new Room(roomId, socket.id, restaurants);

            socket.join(roomId);

            socket.emit("new_room_restaurants", Rooms[roomId].restaurants, queryLimitHit);

            console.log(`Socket successfully started room ${roomId}`);
        }

        socketRooms[socket.id] = roomId;

        // disconnect the socket from its connection room
        io.in(socket.id).socketsLeave(socket.id);
    });

    socket.on("new_room_restaurants_with_details", (restaurants) => {
        const socketRoomId = socketRooms[socket.id];
        const socketRoom = Rooms[socketRoomId];

        socketRoom.restaurantsHaveDetails = true;
        socketRoom.setRestaurants(restaurants);
    })

    socket.on('swipe', (index, direction) => {
        const socketRoomId = socketRooms[socket.id];

        if (!socketRoomId) return;

        const socketRoom = Rooms[socketRoomId];

        if (direction === "right") {
            socketRoom.addMemberLike(socket.id, index);
        } else if (direction === "left") {
            socketRoom.addMemberDislike(socket.id, index);
        }

        const updatedLikesAndDislikes = socketRoom.likesAndDislikes;

        // logic to determine if a match was found. If swiped restaurant has the same number of likes as members in the room => match.
        const swipedRestaurantLikesAndDislikes = socketRoom.likesAndDislikes[index].likes;
        const numMembersInRoom = Object.keys(socketRoom.members).length;
        if (numMembersInRoom !== 1 && swipedRestaurantLikesAndDislikes === numMembersInRoom) {
            const restaurant = socketRoom.restaurants[index];

            io.in(socketRoomId).emit("match_found", restaurant);
        }

        // emitting updated likes and dislikes to all sockets in the room for voting modal
        io.in(socketRoomId).emit('likes_and_dislikes', updatedLikesAndDislikes);
    });

    socket.on('undo', (index) => {
        const socketRoomId = socketRooms[socket.id];
        const socketRoom = Rooms[socketRoomId];
        socketRoom.undoMemberSwipe(socket.id, index);

        const updatedLikesAndDislikes = socketRoom.likesAndDislikes;

        io.in(socketRoomId).emit('likes_and_dislikes', updatedLikesAndDislikes);
    });

    socket.on('disconnect', () => {
        console.log("A socket has disconnected.");

        const roomId = socketRooms[socket.id];
        const socketRoom = Rooms[roomId];

        if (socketRoom) delete socketRoom.members[socket.id];

        delete socketRooms[socket.id];
        
        // sync the Rooms list with server rooms on deletion
        const serverRooms = io.sockets.adapter.rooms;
        for (const roomId in Rooms) {
            if (!serverRooms.has(roomId)) {
                delete Rooms[roomId];
            }
        }
    });
});

httpServer.on("error", (err) => {
    console.log("Error opening server");
});

httpServer.listen(process.env.PORT || 3500, () => {
    console.log("Server listening on port 3500");
});
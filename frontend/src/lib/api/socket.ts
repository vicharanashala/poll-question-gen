import { io, Socket } from 'socket.io-client';

// You can type it using your own event types, or use `any` for now if unsure
const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080', {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
});

export default socket;

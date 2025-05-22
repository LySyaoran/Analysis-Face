export const WS_URL = import.meta.env.WS_URL || "ws://127.0.0.1:8000/ws";
let socket;
export const connectSocket = (onMessage) => {
  socket = new WebSocket(WS_URL);
  socket.onopen = () => console.log("WebSocket connected");
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("WebSocket message", data);
    onMessage(data);
  };
  socket.onerror = (err) => console.error("WebSocket error", err);
  socket.onclose = () => console.log("WebSocket closed");
};
export const sendFrame = (base64) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(base64.split(",")[1]); // strip prefix
  }
};

// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public')); // serve client

// State
let state = {
  total: 5,
  available: 5,
  slots: [0,0,0,0,0],
  logs: []
};

app.post('/update', (req, res) => {
  const data = req.body;
  console.log('POST /update =>', data);

  if (!data || !data.type) {
    return res.status(400).json({ ok:false, msg:'bad payload' });
  }

  if (data.type === 'slot_change') {
    const idx = (data.slot || 1) - 1;
    if (idx >=0 && idx < state.slots.length) {
      state.slots[idx] = data.occupied ? 1 : 0;
      state.available = data.available || (state.total - state.slots.reduce((a,b)=>a+b,0));
      state.logs.unshift({ time: new Date().toISOString(), msg: `Slot ${idx+1} -> ${data.occupied ? 'Occupied' : 'Free'}` });
    }
  } else if (data.type === 'rfid_in' || data.type === 'rfid_out') {
    state.logs.unshift({ time: new Date().toISOString(), msg: `RFID ${data.type} -> ${data.result || ''}` });
    state.available = data.available || state.available;
  } else {
    state.logs.unshift({ time: new Date().toISOString(), msg: `Unknown event: ${JSON.stringify(data)}` });
  }

  // keep logs reasonable
  if (state.logs.length > 200) state.logs.pop();

  // broadcast
  io.emit('update', state);
  return res.json({ ok:true });
});

// serve a simple UI
app.get('/', (req,res)=> res.sendFile(__dirname + '/public/index.html'));

// socket connection
io.on('connection', socket => {
  console.log('Client connected');
  socket.emit('update', state);
});

const PORT = 3000;
server.listen(PORT, ()=> console.log(`Server listening on http://0.0.0.0:${PORT}`));

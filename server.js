// FULL AUCTION WEB – Backend + Frontend (FIXED)
// Công nghệ: Node.js + Express + MongoDB + Socket.IO
// ================= BACKEND =================

// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// ===== Models =====
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  balance: { type: Number, default: 0 }
});

const AuctionSchema = new mongoose.Schema({
  product: String,
  duration: Number,
  startPrice: Number,
  currentPrice: Number,
  endTime: Date,
  winner: String,
  status: { type: String, default: "active" }
});

const BidSchema = new mongoose.Schema({
  auctionId: mongoose.Schema.Types.ObjectId,
  user: String,
  amount: Number,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Auction = mongoose.model("Auction", AuctionSchema);
const Bid = mongoose.model("Bid", BidSchema);

// ===== API =====
app.post("/api/user", async (req, res) => {
  const user = await User.create({ username: req.body.username });
  res.json(user);
});

app.post("/api/topup", async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.balance += amount;
  await user.save();
  res.json(user);
});

app.post("/api/auction", async (req, res) => {
  const { product, duration, startPrice } = req.body;
  const auction = await Auction.create({
    product,
    duration,
    startPrice,
    currentPrice: startPrice,
    endTime: new Date(Date.now() + duration * 60000)
  });
  res.json(auction);
});

app.get("/api/auctions", async (req, res) => {
  res.json(await Auction.find().sort({ endTime: 1 }));
});

// ===== Socket.IO =====
io.on("connection", socket => {
  socket.on("bid", async ({ auctionId, userId, amount }) => {
    const auction = await Auction.findById(auctionId);
    const user = await User.findById(userId);

    if (!auction || auction.status !== "active") return;
    if (!user || amount <= auction.currentPrice) return;
    if (user.balance < amount) return;

    auction.currentPrice = amount;
    auction.winner = user.username;
    await auction.save();

    await Bid.create({ auctionId, user: user.username, amount });

    io.emit("update", auction);
  });
});

// ===== Auto close auctions =====
setInterval(async () => {
  const now = new Date();
  const ended = await Auction.find({ status: "active", endTime: { $lte: now } });
  for (const a of ended) {
    a.status = "ended";
    await a.save();
    io.emit("ended", a);
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));

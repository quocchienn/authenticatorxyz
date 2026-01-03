// FULL AUCTION WEB – Backend + Frontend
// Công nghệ: Node.js + Express + MongoDB + Socket.IO
// Deploy: Render (Web Service)
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
username: String,
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
const user = await User.findById(req.body.userId);
user.balance += req.body.amount;
await user.save();
res.json(user);
});


app.post("/api/auction", async (req, res) => {
const auction = await Auction.create({
product: req.body.product,
duration: req.body.duration,
startPrice: req.body.startPrice,
currentPrice: req.body.startPrice,
endTime: new Date(Date.now() + req.body.duration * 60000)
});
res.json(auction);
});


app.get("/api/auctions", async (req, res) => {
res.json(await Auction.find());
});


// ===== Socket.IO =====
io.on("connection", socket => {
server.listen(PORT, () => console.log("Running on", PORT));

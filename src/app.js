require('dotenv').config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const ticketRoutes = require("./routes/ticket.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/tickets", require("./routes/ticket.routes"));


module.exports = app;


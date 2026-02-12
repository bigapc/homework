require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Serve the frontend
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ SafeConnect running at http://localhost:${PORT}`);
});


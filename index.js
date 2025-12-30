const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();

// middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const port = process.env.PORT || 5000;

// Mongo URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6ighsxv.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected");

    const db = client.db("productDB");

    const collections = {
      sellingRate: db.collection("sellingRate"),
      customers: db.collection("customers"),
      employees: db.collection("employees"),
      attendance: db.collection("attendance"),
      advances: db.collection("advances"),
    };

    // mount all routes
    require("./routes/routes")(app, collections);

    app.get("/", (req, res) => {
      res.send("Office App API Running");
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Ping successful");
  } catch (err) {
    console.error(err);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

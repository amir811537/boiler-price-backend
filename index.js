const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// midewaare
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6ighsxv.mongodb.net/?appName=Cluster0`;
// console.log(uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const sellingRateCollection=client.db('productDB').collection('sellingRate');


//  posting selling rate api
app.post("/sellingRate", async (req, res) => {
  const { date, rates, createdAt } = req.body;

  const result = await sellingRateCollection.updateOne(
    { date }, // find by date
    {
      $set: {
        date,
        createdAt,
      },
      $push: {
        rates: { $each: rates }
      }
    },
    { upsert: true } // 🔥 creates if not exists
  );

  res.send(result);
});


// getting selling rate api
app.get("/sellingRate", async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split("T")[0];

  const doc = await sellingRateCollection.findOne({ date: targetDate });

  res.send({
    date: targetDate,
    rates: doc?.rates || [],
  });
});


// updating selling rate api
app.patch("/sellingRate", async (req, res) => {
  const { date, customerName, proposalPrice, actualSellingPrice } = req.body;

  if (!date || !customerName) {
    return res.status(400).send({ message: "date and customerName required" });
  }

  const update = {};

  if (proposalPrice) {
    update["rates.$.proposalPrice"] = proposalPrice;
  }

  if (actualSellingPrice) {
    update["rates.$.actualSellingPrice"] = actualSellingPrice;
  }

  const result = await sellingRateCollection.updateOne(
    { date, "rates.customerName": customerName },
    { $set: update }
  );

  res.send(result);
});


//  deleting selling rate api date 
app.delete("/sellingRate/customer", async (req, res) => {
  const { date, customerName } = req.body;

  if (!date || !customerName) {
    return res
      .status(400)
      .send({ message: "date and customerName required" });
  }

  const result = await sellingRateCollection.updateOne(
    { date },
    {
      $pull: {
        rates: { customerName: customerName }
      }
    }
  );

  res.send({
    success: true,
    message: "Customer selling rate deleted successfully",
    result
  });
});

//  this is test comment 

//  deleting selling rate api date wise 
app.delete("/sellingRate/date", async (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.status(400).send({ message: "date required" });
  }

  const result = await sellingRateCollection.deleteOne({ date });

  res.send({
    success: true,
    message: "Selling rate of the date deleted successfully",
    result
  });
});



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Crud is running...");
});

app.listen(port, () => {
  console.log(`Simple Crud is Running on port ${port}`);
});

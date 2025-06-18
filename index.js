require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.zxppowi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Define a root route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Connect to MongoDB and start the server
async function run() {
  try {
    await client.connect();

    const eventsCollection = client.db('civitas').collection('events');
    app.get('/events', async (req, res) =>{
      const cursor = eventsCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

app.get('/events/:id', async (req, res) => {
  const { id } = req.params;

  const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

  if (event) {
    res.send(event);
  } else {
    res.status(404).send({ error: "Event not found" });
  }
});
















    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    






    // Start the Express server after MongoDB connection is established
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// Don't close the connection - keep it open for the application
run().catch(console.dir);
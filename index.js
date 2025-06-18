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


    // Get all events with filtering and search
 app.get("/events", async (req, res) => {
    const { eventType, search } = req.query;
    const query = {};
    if (eventType) query.eventType = eventType;
    if (search) query.title = { $regex: search, $options: "i" };
    const cursor = eventsCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
});

// Get event by ID


app.get("/events/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (event) {
            res.send(event);
        } else {
            res.status(404).send({ message: "Event not found" });
        }
    } catch (error) {
        res.status(400).send({ message: "Invalid event ID" });
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
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.zxppowi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "No authorization header" });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email
        };
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).json({ 
            message: "Invalid token",
            error: error.message 
        });
    }
};

app.get("/", (req, res) => {
  res.send("Server is running!");
});

async function run() {
  try {
    await client.connect();
    const eventsCollection = client.db("civitas").collection("events");
    const participationsCollection = client
      .db("civitas")
      .collection("participations");

    // Get all events with filtering and search
    app.get("/events", async (req, res) => {
      const { eventType, searchQuery } = req.query;
      const query = {};
      if (eventType)
        query.eventType = { $regex: `^${eventType}$`, $options: "i" };
      if (searchQuery) query.title = { $regex: searchQuery, $options: "i" };
    //   console.log("Events query:", query);
      const cursor = eventsCollection.find(query);
      const result = await cursor.toArray();
    //   console.log("Events found:", result.length);
      res.json(result);
    });


    app.get("/events/created", verifyToken, async (req, res) => {
        
        const userEmail = req.user.email; 
        // console.log("Fetching created events for user:", userEmail);

        if (!userEmail) {
            // console.log("DEBUG: User email not found in token for /events/created.");
            return res
                .status(400)
                .json({ message: "User email not found in token." });
        }

        try {
            
            const createdEvents = await eventsCollection
                .find({ creatorEmail: userEmail }) 
                .toArray();

            // console.log( `Found ${createdEvents.length} events created by ${userEmail}.`);
            res.json(createdEvents);
        } catch (error) {
            console.error("Error fetching created events:", error);
            res
                .status(500)
                .json({
                    message: "Failed to fetch created events",
                    error: error.message,
                });
        }
        
    });
    




    // Get event by ID
    app.get("/events/:id", verifyToken, async (req, res) => {
        
const { id } = req.params;
        // console.log("Attempting to find event by ID:", id);
 try {
 const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
 if (!event) {
 return res.status(404).json({ message: "Event not found" });
 }
 res.json(event);
 } catch (error) {
 res.status(400).json({ message: "Invalid event ID" });
}
        
});

    // Join event
    app.post("/participations", verifyToken, async (req, res) => {
      const { userEmail, eventId } = req.body;
      if (req.user.email !== userEmail) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const existing = await participationsCollection.findOne({
        userEmail,
        eventId,
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "You have already joined this event" });
      }
      const result = await participationsCollection.insertOne({
        userEmail,
        eventId,
        joinedAt: new Date(),
      });
      res.json({
        message: "Successfully joined the event",
        id: result.insertedId,
      });
    });

    // Get joined events
    app.get("/participations", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      try {
        const participations = await participationsCollection
          .find({ userEmail: email })
          .toArray();
        if (!participations.length) {
          return res.json([]);
        }
        const eventIds = participations.map((p) => new ObjectId(p.eventId));
        const events = await eventsCollection
          .find({ _id: { $in: eventIds } })
          .toArray();
        const joinedEvents = events.map((event) => {
          const participation = participations.find(
            (p) => p.eventId === event._id.toString()
          );
          return { ...event, joinedAt: participation.joinedAt };
        });
        res.json(joinedEvents);
      } catch (error) {
        console.error("Error fetching participations:", error);
        res.status(500).json({ message: "Failed to fetch joined events" });
      }
    });

    // Create event
    app.post("/events", verifyToken, async (req, res) => {
      const {
        title,
        description,
        eventType,
        thumbnail,
        location,
        date,
        creatorEmail,
      } = req.body;
      if (req.user.email !== creatorEmail) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const event = {
        title,
        description,
        eventType,
        thumbnail,
        location,
        date: new Date(date),
        creatorEmail,
        createdAt: new Date(),
      };
      const result = await eventsCollection.insertOne(event);
      res.json({
        message: "Event created successfully",
        id: result.insertedId,
      });
    });

    // Get events created by user

app.get("/events/created", verifyToken, async (req, res) => {
    try {
        // console.log("User email from token:", req.user.email); 
        
        if (!req.user || !req.user.email) {
            return res.status(400).json({ message: "User email not available" });
        }

        const events = await eventsCollection.find({ 
            creatorEmail: req.user.email 
        }).toArray();

        // console.log("Found events:", events.length); 
        res.status(200).json(events);
    } catch (error) {
        console.error("Error in /events/created:", error);
        res.status(500).json({ 
            message: "Server error fetching events",
            error: error.message 
        });
    }
});

    // Update event
    app.patch("/events/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { title, description, eventType, thumbnail, location, date } =
        req.body;
      if (!req.user.email) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        if (event.creatorEmail !== req.user.email) {
          return res
            .status(403)
            .json({ message: "Unauthorized to update this event" });
        }
        const updatedEvent = {
          $set: {
            title,
            description,
            eventType,
            thumbnail,
            location,
            date: new Date(date),
            updatedAt: new Date(),
          },
        };
        const result = await eventsCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedEvent
        );
        if (result.modifiedCount === 0) {
          return res
            .status(400)
            .json({ message: "No changes made to the event" });
        }
        res.json({ message: "Event updated successfully" });
      } catch (error) {
        console.error("Error updating event:", error);
        res.status(400).json({ message: "Invalid event ID or data" });
      }
    });

    // Delete event
    app.delete("/events/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!req.user.email) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        if (event.creatorEmail !== req.user.email) {
          return res
            .status(403)
            .json({ message: "Unauthorized to delete this event" });
        }
        // Delete associated participations
        await participationsCollection.deleteMany({ eventId: id });
        // Delete the event
        const result = await eventsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(400).json({ message: "Event not deleted" });
        }
        res.json({ message: "Event deleted successfully" });
      } catch (error) {
        console.error("Error deleting event:", error);
        res.status(400).json({ message: "Invalid event ID" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

run().catch(console.dir);

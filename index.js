require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
});

// MongoDB connection
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

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).send({ message: "No token provided" });
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).send({ message: "Invalid token" });
    }
};

app.get("/", (req, res) => {
    res.send("Server is running!");
});

async function run() {
    try {
        await client.connect();
        const eventsCollection = client.db("civitas").collection("events");
        const participationsCollection = client.db("civitas").collection("participations");

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

        // Join event
        app.post("/participations", verifyToken, async (req, res) => {
            const { userEmail, eventId } = req.body;
            if (req.user.email !== userEmail) {
                return res.status(403).send({ message: "Unauthorized" });
            }
            const existing = await participationsCollection.findOne({ userEmail, eventId });
            if (existing) {
                return res.status(400).send({ message: "You have already joined this event" });
            }
            const result = await participationsCollection.insertOne({
                userEmail,
                eventId,
                joinedAt: new Date(),
            });
            res.send({ message: "Successfully joined the event", id: result.insertedId });
        });

        app.get("/participations", verifyToken, async (req, res) => {
    const { email } = req.query;
    if (req.user.email !== email) {
        return res.status(403).send({ message: "Unauthorized" });
    }
    try {
        const participations = await participationsCollection.find({ userEmail: email }).toArray();
        if (!participations.length) {
            return res.send([]);
        }
        const eventIds = participations.map(p => new ObjectId(p.eventId));
        const events = await eventsCollection.find({ _id: { $in: eventIds } }).toArray();
        const joinedEvents = events.map(event => {
            const participation = participations.find(p => p.eventId === event._id.toString());
            return { ...event, joinedAt: participation.joinedAt };
        });
        res.send(joinedEvents);
    } catch (error) {
        console.error('Error fetching participations:', error);
        res.status(500).send({ message: "Failed to fetch joined events" });
    }
});

        // Create event (for Create.jsx)
        app.post("/events", verifyToken, async (req, res) => {
            const { title, description, eventType, thumbnail, location, date, creatorEmail } = req.body;
            if (req.user.email !== creatorEmail) {
                return res.status(403).send({ message: "Unauthorized" });
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
            res.send({ message: "Event created successfully", id: result.insertedId });
        });

        // Get events created by user (for future Manage.jsx)
        app.get("/events/created", verifyToken, async (req, res) => {
            const { email } = req.query;
            if (req.user.email !== email) {
                return res.status(403).send({ message: "Unauthorized" });
            }
            const events = await eventsCollection.find({ creatorEmail: email }).toArray();
            res.send(events);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

run().catch(console.dir);